/**
 * THE CUSTOMER'S REMAINING SURFACE — C7 REPORTS, C7 EXPORT, C8 SPEND, C11 AUDIT
 * — AND WHY G300 ADMITS NONE OF THE FOUR.
 *
 * ┌─ WHAT THIS FILE IS FOR ───────────────────────────────────────────────────┐
 * │ G318 sequences the customer close: *"INGESTION, EXCEPTIONS,               │
 * │ CORRESPONDENCE, AND ONLY THEN THE PARTNER PORTAL AND THE STAFF CONSOLE"*. │
 * │ The first three have landed. THIS FILE IS THE FOURTH WAVE ARRIVING AND    │
 * │ FINDING NOTHING IT MAY MOUNT, and it records WHY MECHANICALLY rather      │
 * │ than in a paragraph somebody has to believe.                              │
 * │                                                                           │
 * │ G300 lifts G296's freeze *"for any operation whose TABLE, MODEL and       │
 * │ CAPABILITY are all real"*, and its own warning is the one that decides    │
 * │ every section below: **"a table alone is the trap."** Each section        │
 * │ DERIVES the missing part rather than asserting readiness, exactly as      │
 * │ that row instructs.                                                       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE FOUR VERDICTS, EACH DERIVED BY A SECTION BELOW.
 *
 *   C11 · Read the audit trail        NO DECLARED OPERATION, on any tier. §1.
 *                                     And no writer for the stream. §2.
 *   C8  · Watch spend against the plan NO DECLARED OPERATION, on any tier. §1.
 *                                     And no ceiling to watch against. §3.
 *   C7  · Reports as a canvas         ✅ **MOUNTED 20 Sep 2026, G951–G954.**
 *                                     ⚠️ THIS ROW READ *"`getDispositionMix`
 *                                     IS declared and its capability is real,
 *                                     and TWO of its SIX required response
 *                                     fields have no producer in this
 *                                     database"* and is corrected rather than
 *                                     deleted: G657's `tenant.disposition`
 *                                     gave `label` and `family` a producer and
 *                                     §4's own tripwire fired and said so.
 *                                     §4 now asserts the MOUNT. ⚠️ A SECOND
 *                                     blocker was found on the way in and is
 *                                     refused rather than ignored: `periodId`
 *                                     is a declared filter nothing can apply —
 *                                     see `server/data-plane/reports.ts`.
 *   C7  · Export and scheduled delivery `createExport`/`getExport` ARE declared
 *                                     and no table holds an export. §5.
 *
 * ⚠️ NOTHING HERE IS A PROPOSAL AND NOTHING HERE MOUNTS. Each section goes RED
 * the moment its blocker is removed, which is the point: the next slice to
 * reach one of these four screens arrives against a failing test that names
 * what it just changed, rather than against a comment it can read past. That
 * is `tests/db/correspondence.test.ts` §6's shape and `0015` §6's, applied to
 * a wave that landed no route.
 *
 * ┌─ WHY THIS FILE NEEDS NO DATABASE AND NO PORT ─────────────────────────────┐
 * │ Every claim below is about what is DECLARED — in the six contract         │
 * │ documents, in `model/`'s closed capability set, in the migration text and │
 * │ in the server source tree. None of it is about what a running plane       │
 * │ answers, because none of these four operations is mounted and a plane has │
 * │ nothing to say about a route it does not serve. Keeping it out of the     │
 * │ `{ skip }` suites means it runs on a machine with no PostgreSQL, which is │
 * │ where a successor is most likely to be reading it.                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE §5.6 GUARDS ARE EXPLICIT AND THEY COME FIRST IN EVERY SECTION. A file
 *    whose every assertion is an absence is *"a control whose only observable
 *    behaviour is refusal"*, and the answer this record has settled on is a
 *    POSITIVE assertion beside each negative one: §1 requires the reachable
 *    capability set to be non-empty and to contain a named member, §4 requires
 *    the field list it checks to have been READ from the contract rather than
 *    typed here, and §2 requires the three writers to exist before it asserts
 *    they have no caller. Neuter the derivation and the guard fails, not the
 *    absence.
 *
 * ┌─ SECTIONS TO TESTS, because the two are numbered differently on purpose ──┐
 * │ §1 → tests 1 and 2   §2 → test 3   §3 → test 4   §4 → test 5   §5 → test 6 │
 * │ The SECTIONS are the four screens' four blockers; the TESTS are what the   │
 * │ runner prints. §1 is two tests because the roster claim and the three      │
 * │ named verbs fail for different reasons and should fail separately.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * WITNESSED RED — each mutation applied alone, at the LAST writer of the
 * property, and reverted. The assertion text is the runner's, quoted:
 *
 *   M1 · `x-capability: view_dashboard` -> `view_audit` on `getDispositionMix`
 *        (docs/contracts/capability.openapi.yaml). TEST 2 RED —
 *        *"AN OPERATION NOW NAMES `view_audit`, AND THAT IS A RULING, NOT A
 *        PATCH."*
 *   M2 · `CREATE TABLE tenant.disposition (…)` appended to
 *        db/migrations/0022_correspondence.sql, the LAST writer of this
 *        schema's table set. TEST 5 RED — *"A DISPOSITION CATALOGUE TABLE HAS
 *        APPEARED (disposition), WHICH UNBLOCKS `getDispositionMix` AND OWES
 *        THREE THINGS IN THE SAME COMMIT."*
 *   M3 · `writeAuditEvent(null, null)` called from server/data-plane/runs.ts.
 *        TEST 3 RED — *"AN INVARIANT 10 STREAM HAS GROWN A PRODUCTION WRITER:
 *        server/data-plane/runs.ts → writeAuditEvent"*.
 *   M4 · `label` removed from `getDispositionMix`'s 200 row `required` list.
 *        TEST 5 RED — *"`label` IS NO LONGER REQUIRED ON THE DISPOSITION MIX
 *        ROW."* ⚠️ THE FIRST DRAFT OF THIS HEADER PREDICTED THE §5.6 GUARD
 *        WOULD CATCH IT AND IT DID NOT: the guard checks `dispositionKey` and
 *        `count`, which M4 leaves in place, so the NAMED-FIELD assertion fired
 *        instead. Recorded as measured rather than as predicted.
 *   M5 · `CREATE TABLE tenant.export (…)` appended to 0022. TEST 6 RED —
 *        *"AN EXPORT TABLE HAS APPEARED (export)."*
 *   M6 · `x-capability: view_audit` on `listInvoices` in the UNREGISTERED
 *        administration tier ALONE. TEST 2 RED. This is the differential that
 *        matters: `declaredOperations()` structurally cannot see that file, so
 *        M6 is the only thing proving the hand reader is load-bearing.
 *   M7 · the unregistered-tier filter replaced with `.filter(() => false)`.
 *        TEST 1 RED — *"THE UNREGISTERED-TIER LIST NO LONGER HOLDS
 *        `administration.openapi.yaml` … Found: []."*
 *   M7b· the hand reader's `x-capability` pattern misspelled so it matches
 *        nothing. TEST 1 RED on the annotation-count guard.
 *
 * 🛑 AND THE TWO MUTATIONS THAT WERE **NOT** CAUGHT, REPORTED RATHER THAN
 *    QUIETLY FIXED, because a mutation budget whose misses go unrecorded is
 *    worth less than no budget at all:
 *
 *   M7 AND M7b WERE NOT CAUGHT BY THE FIRST VERSION OF THIS FILE. All six
 *   tests stayed green with the administration tier unread. The guards in
 *   TEST 1 exist because of that miss, and they are the only reason M6 means
 *   anything. That gap is CLOSED.
 *
 *   ⛔ M8 IS NOT CAUGHT AND IS NOT CLOSED. A disposition catalogue named
 *   `tenant.installed_pack_entry` — tenant_id, key, label, family, which is
 *   exactly the shape TEST 5 says has no producer — passes all six.
 *   §4's pattern matches `disposition`, `solution_pack`, `pack` and
 *   `pack_catalogue`, and a catalogue under any other name walks through.
 *   **This is NOT repaired by widening the pattern to more guesses**, for the
 *   reason `tests/db/event-streams.test.ts` §1d states about the same
 *   temptation: a pattern extended to names nobody has proposed is a rule
 *   keyed on a convenient landmark instead of the property it protects, and
 *   the property here — *"two required response fields have no producer"* —
 *   is not expressible as a table-name regex at all. **The thing that would
 *   actually close it is a control asserting that every MOUNTED operation's
 *   response carries every `required` field its contract declares**, which is
 *   G284's near-miss generalised and is a slice of its own. Until then TEST 5
 *   is a tripwire on the obvious spellings and nothing more, and it says so.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { CAPABILITIES } from '../../model/access.ts'
import { CONTRACTS_DIR, TIERS, loadTier } from '../../server/contract/document.ts'
import { declaredOperations, ANNOTATION_KEY } from '../../tools/check-capability-annotations.mjs'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'db', 'migrations')

/**
 * ✅ `administration.openapi.yaml` IS IN `TIERS` SINCE G533, 19 Sep 2026, AND
 *    THEREFORE IN `declaredOperations()`. THE HAND READER BELOW SURVIVES
 *    ANYWAY, AND THE PARAGRAPH THAT EXPLAINED IT IS QUOTED RATHER THAN
 *    DELETED, because its argument is why the reader must not be removed:
 *
 *      *"🛑 `administration.openapi.yaml` IS NOT IN `TIERS` AND THEREFORE NOT
 *      IN `declaredOperations()`, WHICH IS WHY IT IS LOADED BY HAND HERE …
 *      A claim of the form "no operation ANYWHERE names this capability" that
 *      read only the registered tiers would be a totality claim over a proper
 *      subset — the §5.6 shape with a denominator. FIFTY-NINE operations sit
 *      in that file and two of them (`listInvoices`, `getInvoice`) are the
 *      closest thing in the corpus to C8, so the omission would not have been
 *      harmless."*
 *
 * 🛑 **THE SHAPE THE PARAGRAPH DESCRIBES IS NOT FIXED BY REGISTERING ONE
 *    FILE — IT IS FIXED BY READING WHATEVER IS UNREGISTERED, WHICH IS WHAT
 *    THIS DERIVATION DOES.** `UNREGISTERED_TIER_FILES` is computed from the
 *    directory listing minus `TIERS`, so it is EMPTY today and picks up the
 *    SEVENTH contract file on the day somebody lands one without registering
 *    it. Deleting it would re-open the exact hole on the next tier. The guard
 *    below therefore no longer requires the list to be non-empty — it
 *    requires the administration tier to be READ, through whichever of the
 *    two readers now owns it.
 *
 * ⚠️ FIFTY-NINE AND NOT SIXTY, AND THE OFF-BY-ONE IS WORTH THE SENTENCE:
 * `grep -c 'operationId:'` on that file returns 60, and the sixtieth match is
 * the DERIVATION COMMAND quoted inside one of its own descriptions. The same
 * trap sits on `x-capability` — 60 lines, 59 annotations, the extra one being
 * prose naming `view_commercial` in backticks mid-line. The pattern below is
 * anchored to the start of a line for exactly that reason.
 *
 * ⚠️ AND THE MEASURED CONSEQUENCE IS BETTER THAN THE FEARED ONE, WHICH IS
 * RECORDED BECAUSE THE FIRST DRAFT OF THIS COMMENT GUESSED WRONG. Unanchored,
 * the extra match yields the STRING ``view_commercial` would declare a gate
 * **its own`` — not the bare verb — so TEST 1's roster-subset assertion goes
 * RED rather than the reachable set quietly growing a member. **The anchor is
 * belt; the closed-roster check is braces**, and it is the braces that make a
 * regex over prose safe here at all. Derive it:
 *   grep -cE '^ +x-capability:' docs/contracts/administration.openapi.yaml  # 59
 *   grep -c  'x-capability'     docs/contracts/administration.openapi.yaml  # 60
 *
 * Derive the file's presence rather than trusting this comment:
 *   `ls docs/contracts/*.openapi.yaml` · `node -e "console.log(Object.keys(require))"`
 */
const UNREGISTERED_TIER_FILES = readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith('.openapi.yaml'))
  .filter((f) => !Object.values(TIERS).includes(f))

/**
 * Every `x-capability` value in the corpus that NAMES a capability rather than
 * exempting — plus the COUNT of annotations the hand parser saw on the
 * unregistered tiers, which is the only thing that can tell a working reader
 * from a broken one.
 *
 * 🛑 THE COUNT IS HERE BECAUSE THE FIRST VERSION OF THIS FILE DID NOT HAVE IT
 *    AND WAS CAUGHT BY ITS OWN MUTATION BUDGET. Replacing the unregistered-tier
 *    filter with `.filter(() => false)` left **all six tests green**: the
 *    registered tiers alone satisfy §1's `view_exception` guard, so the guard
 *    proved the REGISTERED reader worked and said nothing at all about the hand
 *    one. **A §5.6 guard that only covers half a derivation is §5.6.** Every
 *    absence in §1 and §2 is a claim about FIFTY-NINE administration operations as
 *    much as about the seventy-six registered ones, and nothing was checking
 *    that half.
 */
function capabilitiesNamedByAnyOperation() {
  const named = new Set()
  /**
   * ⚠️ COUNTED SEPARATELY SINCE G533, and it replaces
   * `unregisteredAnnotations` as the half-derivation guard rather than
   * joining it. The mutation the block above records — neuter one reader and
   * watch six tests stay green — is still possible; what changed is WHICH
   * reader owns the fifty-nine. If `declaredOperations()` stopped seeing the
   * administration tier (a bad `TIERS` edit, a parse failure swallowed by a
   * `continue`), every absence below would go vacuous over a third of the
   * corpus and the unregistered list would still be legitimately empty.
   */
  let administrationAnnotations = 0
  for (const op of declaredOperations()) {
    const a = op[ANNOTATION_KEY] ?? op.annotation
    if (op.tier === 'administration' && typeof a === 'string') administrationAnnotations += 1
    if (typeof a === 'string' && !a.trim().startsWith('exempt:')) named.add(a.trim())
  }
  /* The unregistered tiers, read straight off disk for the reason above. */
  let unregisteredAnnotations = 0
  for (const file of UNREGISTERED_TIER_FILES) {
    const text = readFileSync(path.join(CONTRACTS_DIR, file), 'utf8')
    for (const m of text.matchAll(/^\s*x-capability:\s*(?:'([^']*)'|"([^"]*)"|([^\s'"#][^\n]*))$/gm)) {
      const value = (m[1] ?? m[2] ?? m[3] ?? '').trim()
      if (!value) continue
      unregisteredAnnotations += 1
      if (!value.startsWith('exempt:')) named.add(value)
    }
  }
  return { named, unregisteredAnnotations, administrationAnnotations }
}

/** The whole migration corpus as one string — the tenant schema, as declared. */
function migrationText() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
}

/** `CREATE TABLE tenant.<name>` — the tables this database actually declares. */
function declaredTenantTables() {
  const out = new Set()
  for (const m of migrationText().matchAll(/^CREATE TABLE tenant\.("?)([a-z_]+)\1\s*\(/gm)) {
    out.add(m[2])
  }
  return out
}

/* ==================================================================== *
 * §1 · C11 AND C8 ARE BUILT ON CAPABILITIES NO OPERATION NAMES.
 *
 * 🛑 THIS IS THE WHOLE OF WHY NEITHER SCREEN COULD BE MOUNTED IN THIS
 *    WAVE, AND IT IS A FACT ABOUT THE CONTRACT RATHER THAN ABOUT A
 *    TABLE. G300's three-part test cannot even be STARTED for an
 *    operation that does not exist: `mountTier()` refuses a handler
 *    whose key is not an `operationId` in the document, so there is no
 *    handler a slice could write.
 * ==================================================================== */

test('1 · the capability ROSTER is closed and REACHABLE is a strict subset of it', () => {
  const roster = new Set(Object.values(CAPABILITIES))
  const { named: reachable, administrationAnnotations } = capabilitiesNamedByAnyOperation()

  /**
   * §5.6 GUARD, POSITIVE, FIRST, AND IN BOTH HALVES. A parser that read nothing
   * would make every absence below true. `view_exception` is named by SEVEN
   * capability-tier operations, THREE of which are MOUNTED, so its presence is
   * the cheapest proof that the REGISTERED reader reached the documents.
   * Derive both, never read them — the second is written without the glob on
   * purpose, because a `*` followed by a `/` inside a block comment CLOSES THE
   * COMMENT, and this file was briefly unparseable for exactly that reason
   * while the derivation was being quoted. `server/data-plane/start.ts`
   * carries the same note for the same accident:
   *   grep -c 'x-capability: view_exception' docs/contracts/capability.openapi.yaml
   *   grep -rn 'handlers:' over the two `start.ts` files under `server/`
   */
  assert.ok(
    reachable.size > 0,
    'THE DERIVATION READ NO CAPABILITY AT ALL. Every absence asserted below this line is ' +
      'vacuous until this passes — the §5.6 shape, which is why this guard is first.',
  )
  assert.ok(
    reachable.has('view_exception'),
    'THE DERIVATION MISSED `view_exception`, which seven declared operations name and three ' +
      'MOUNTED ones hold. The parser is wrong, not the corpus.',
  )

  /**
   * 🛑 AND THE OTHER HALF, WHICH THE FIRST DRAFT OF THIS FILE LACKED. The two
   *    guards above are satisfied entirely by `declaredOperations()`, which
   *    CANNOT SEE the administration tier — so neutering the hand reader left
   *    this file green while sixty operations went unread. Both a file and an
   *    annotation count, because either alone is satisfiable by a reader that
   *    finds the file and parses nothing out of it.
   */
  assert.ok(
    administrationAnnotations > 40,
    `THE DERIVATION READ ONLY ${administrationAnnotations} ANNOTATION(S) OFF THE ` +
      'ADMINISTRATION TIER, and that file alone declares FIFTY-NINE. Every absence below is ' +
      'vacuous over a third of the corpus until this passes. ⚠️ THIS GUARD READ ' +
      '`UNREGISTERED_TIER_FILES.includes(...)` AND A HAND-PARSED COUNT UNTIL G533 REGISTERED ' +
      'THE TIER; its own message said "in which case delete this guard", and it is REPLACED ' +
      'rather than deleted, because the property it protected — that a claim about the whole ' +
      'corpus has read the whole corpus — did not stop mattering when the reader changed. ' +
      "Derive the truth: `grep -cE '^ +x-capability:' docs/contracts/administration.openapi.yaml`.",
  )
  /**
   * ⚠️ AND THE OTHER DIRECTION, WHICH THE REGISTRATION DID NOT RETIRE: a
   * SEVENTH contract file landing unregistered would be invisible to
   * `declaredOperations()` exactly as the sixth was. The hand reader above
   * still covers it; this asserts the list is the empty one we expect rather
   * than an empty one produced by a broken filter, by naming what it holds.
   */
  assert.deepEqual(
    UNREGISTERED_TIER_FILES,
    [],
    'A CONTRACT DOCUMENT IS DECLARED AND NOT REGISTERED IN `TIERS`. That is not forbidden — ' +
      'G288 landed the administration tier that way deliberately and G533 registered it — ' +
      'but it means `tools/check-capability-annotations.mjs` cannot see a single operation ' +
      'in it, so the gate stage that reads annotations is silent about the whole file. ' +
      'Register it (⚠️ THIS SAID "two lines: `TIERS` and `TIER_REQUIRES_CAPABILITY`, the ' +
      'second a TS2741 until the verdict is argued", and G911 retired that table on ' +
      '20 Sep 2026: it is `TIERS` and `EXEMPT_WITH_A_PERSON_TO_ASK` now, and what the second ' +
      'one asks for is a COUNT rather than a verdict — how many of the file\'s operations ' +
      'state an exemption while declaring a caller who may be a person) or amend this ' +
      'assertion with the reason it stays out. ' +
      `Found: [${UNREGISTERED_TIER_FILES.join(', ')}].`,
  )

  for (const c of reachable) {
    assert.ok(
      roster.has(c),
      `An operation names \`${c}\`, which is not a member of the closed CAPABILITIES set. ` +
        '`tenant.role_capability` can only carry a member, so a grant for this could never ' +
        'be minted and `decide()` would refuse every caller correctly.',
    )
  }
})

test('2 · `view_audit` and `view_metering` are held by NOBODY because nothing declares them', () => {
  const roster = new Set(Object.values(CAPABILITIES))
  const { named: reachable } = capabilitiesNamedByAnyOperation()

  /**
   * 🛑 BOTH VERBS EXIST IN `model/`. That is the fact that makes this a GAP
   *    rather than a decision not to have the feature — the roster says the
   *    product intends to gate an audit read and a meter read, and the wire
   *    offers neither operation to gate.
   *
   * ⚠️ THE CORPUS SAYS THIS ABOUT ITSELF IN TWO PLACES AND BOTH ARE WORTH
   *    QUOTING RATHER THAN RE-DERIVING, because they are the contract
   *    admitting the gap in its own voice — and no document had collected
   *    them. `docs/contracts/data-plane-local.openapi.yaml`, on
   *    `getLocalMetrics`: *"the human-facing meter is `view_metering`,
   *    which has no declared operation anywhere"*. This test is that sentence
   *    made mechanical, and it will outlive the sentence.
   *
   *    And `administration.openapi.yaml`, on `getStaffCase`, says the same of
   *    the third:
   *    *"That is `view_access_log`, classed `tenant_data` … The customer's own
   *    trail is C11 on the capability tier; the staff view of it needs a
   *    data-plane operation under a grant, and is owed."*
   */
  for (const verb of ['view_audit', 'view_metering', 'view_access_log']) {
    assert.ok(roster.has(verb), `\`${verb}\` has left the closed CAPABILITIES set — read the roster.`)
    assert.equal(
      reachable.has(verb),
      false,
      `AN OPERATION NOW NAMES \`${verb}\`, AND THAT IS A RULING, NOT A PATCH.\n\n` +
        'C11 (read the audit trail) and C8 (watch spend against the plan) are the two customer ' +
        'screens built on these verbs, and until this commit NO operation on ANY of the six ' +
        'tiers named one — so neither screen had anything to mount and G300\'s three-part test ' +
        'could not be started. Declaring the operation is permitted (G200 freezes MOUNTING, not ' +
        'declaring) and it is the moment three other things become owed in the same breath:\n' +
        '  · a WRITER for the stream the read would publish (§3 below: there is none), or the ' +
        'read is an honest-looking empty page;\n' +
        '  · for `view_metering`, invariant 5 — every figure DERIVED at read time and ' +
        '`tenant.usage_record` still carrying no price, rate, currency or total column ' +
        '(`tests/db/event-streams.test.ts` §1d);\n' +
        '  · `PARTNER_MASK_MEMBERSHIP.view_metering` is `[]`, so a partner reaches none of it ' +
        'and the operation must not launder the mask by exposing the numbers elsewhere.',
    )
  }
})

/* ==================================================================== *
 * §2 · AND IF ONE WERE DECLARED TODAY, IT WOULD SERVE AN EMPTY PAGE.
 *
 * `0014_invariant_10_event_streams.sql` landed all three of invariant
 * 10's streams and mounted nothing. `CLAUDE.md` states the consequence
 * in its own voice and it is the sentence this section defends:
 *
 *   "a served read records THE AUTHORISATION IT RAN UNDER and not THE
 *    ACCESS."
 *
 * `0007_run_engine_account.sql` set the precedent for saying so:
 * columns land *"proven by a test rather than by a route"*. This is the
 * converse — a route refused because the column has no writer.
 * ==================================================================== */

test('3 · invariant 10\'s three streams have a TABLE, a WRITER, and NO CALLER on any request path', () => {
  const storePath = path.join(REPO_ROOT, 'server', 'data-plane', 'event-stream-store.ts')
  const store = readFileSync(storePath, 'utf8')
  const tables = declaredTenantTables()

  const WRITERS = ['writeAuditEvent', 'writeDataAccessEvent', 'writeUsageRecord']

  /**
   * §5.6 GUARD, POSITIVE. The absence below is only interesting if the writers
   * exist — "nothing calls a function that does not exist" is not a finding.
   */
  for (const fn of WRITERS) {
    assert.ok(
      store.includes(`export async function ${fn}(`),
      `\`${fn}\` is gone from event-stream-store.ts. This section asserts that a REAL writer ` +
        'has no caller; if the writer has been removed, rewrite the section rather than ' +
        'letting it pass vacuously.',
    )
  }
  for (const t of ['audit_event', 'data_access_event', 'usage_record']) {
    assert.ok(tables.has(`${t}`), `\`tenant.${t}\` is gone — 0014 declared it.`)
  }

  /**
   * 🛑 THE ABSENCE, OVER THE SOURCE TREE. `tests/http/session-cookie-channel.test.ts`
   *    §3 asserts a structural fence the same way and for the same reason: a
   *    property of WHICH FILES REFERENCE WHAT is not observable from a running
   *    process, and a grep is the only thing that can see it.
   *
   * The one file that may reference them is the store that declares them.
   * `tests/` may too, and does — `tests/db/event-streams.test.ts` is where all
   * three are exercised, which is `0007`'s precedent exactly.
   */
  const offenders = []
  for (const dir of ['server', 'frontend', 'db', 'tools', 'infra']) {
    const root = path.join(REPO_ROOT, dir)
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && p !== storePath) {
          const text = readFileSync(p, 'utf8')
          for (const fn of WRITERS) {
            /* A call, not a mention: the word followed by `(`. */
            if (new RegExp(`\\b${fn}\\s*\\(`).test(text)) offenders.push(`${path.relative(REPO_ROOT, p)} → ${fn}`)
          }
        }
      }
    }
    try {
      walk(root)
    } catch {
      /* A directory that is not in this tree is not an offender. */
    }
  }

  assert.deepEqual(
    offenders.sort(),
    [],
    'AN INVARIANT 10 STREAM HAS GROWN A PRODUCTION WRITER:\n  ' +
      offenders.join('\n  ') +
      '\n\nTHIS IS GOOD NEWS AND IT IS ALSO A RULING. Until this commit, `CLAUDE.md` was exactly ' +
      'right that "a served read records THE AUTHORISATION IT RAN UNDER and not THE ACCESS" — ' +
      'the three streams had tables (0014, 0017) and no caller outside `tests/`, so any audit or ' +
      'spend surface mounted on them would have been an empty page that LOOKED like a clean ' +
      'record. Whoever lands this owes: (a) the sweep of `CLAUDE.md`\'s sentence, which four ' +
      'files quote; (b) G301\'s question of WHICH path writes WHICH stream, which that row ' +
      'explicitly left open; and (c) the grants — 0014 gave the app role no INSERT it did not ' +
      'argue for, and a writer without one fails closed at the database, which is the right ' +
      'way round.',
  )
})

/* ==================================================================== *
 * §3 · C8 HAS NO CEILING TO WATCH AGAINST.
 *
 * The pack's C8: *"Spend against the ceiling — month to date, the
 * ceiling, what is left and how much of the month remains"*, and, in
 * the same table, *"Nothing behind any of it — no lease is issued,
 * drawn down or renewed, and no step of the ladder fires."*
 * ==================================================================== */

test('4 · no entitlement, lease or plan ceiling is stored, so a spend bar has no second number', () => {
  const tables = declaredTenantTables()

  /** §5.6 GUARD, POSITIVE: the scanner found the tenant schema. */
  assert.ok(tables.size > 30, `the CREATE TABLE scanner found only ${tables.size} tables — it is broken, not the schema`)
  assert.ok(tables.has('usage_record'), 'the scanner missed `tenant.usage_record`, which 0014 declares')

  /**
   * 🛑 ONE EXCLUSION, BY NAME, BECAUSE THE FIRST DRAFT OF THIS TEST WENT RED ON
   *    IT AND THE RED WAS WRONG. `tenant.grant_duration_ceiling` is G292's
   *    ceiling on how long a STAFF ACCESS GRANT may live — `MAX_GRANT_HOURS`,
   *    seeded as reference data by `0008_staff_grant_selection.sql` because *"a
   *    policy expression cannot import a TypeScript constant"*. It is invariant
   *    8's furniture and has nothing to do with spend.
   *
   *    It is excluded BY NAME rather than by narrowing the pattern, so that a
   *    table called `spend_ceiling` or `plan_ceiling` still fires. A pattern
   *    quietly narrowed to make a test green is the failure this record calls
   *    *"a rule keyed on a convenient landmark instead of the property it
   *    protects"*.
   */
  const NOT_A_SPEND_CEILING = new Set(['grant_duration_ceiling'])
  const ceilingish = [...tables]
    .filter((t) => !NOT_A_SPEND_CEILING.has(t))
    .filter((t) => /entitlement|lease|plan|quota|ceiling|budget/.test(t))
  assert.deepEqual(
    ceilingish,
    [],
    `A CEILING TABLE HAS APPEARED (${ceilingish.join(', ')}). C8 is invariant 5's surface and ` +
      'the dangerous one: *"Money is always derived. `UsageRecord` is immutable and unpriced … ' +
      'A raw usage record is volume in the clear."* A ceiling is not itself a price, and storing ' +
      'one is not forbidden — but the figure a spend surface publishes AGAINST it must be ' +
      'DERIVED at read time from `quantity`, never stored, and `tenant.usage_record` must still ' +
      'carry no price, rate, currency or total column. `tests/db/event-streams.test.ts` §1d is ' +
      'that control and it must stay green beside this one going red.',
  )
})

/* ==================================================================== *
 * §4 · C7's REPORT IS THE CLOSE ONE — AND IT IS THE `getRunAccount`
 *      TRAP G300 NAMES: *"a table alone is the trap."*
 *
 * `getDispositionMix` passes two of G300's three parts outright:
 *   MODEL      `reversalIndictsAutonomy()` and `DISPOSITION_FAMILIES`
 *              are in `model/domain.ts`.
 *   CAPABILITY `view_dashboard` is a member of the closed set, so
 *              `tenant.role_capability` can carry it.
 * and MOST of the third: 0015 §1 stores `resolution_mode`,
 * `resolution_disposition_key` and `resolution_at` on `tenant.exception`,
 * and `tenant.exception_reversal` stores `reason`, from which
 * `reversalIndictsAutonomy()` derives the rate.
 *
 * 🛑 WHAT IT DOES NOT HAVE IS `label` AND `family`, WHICH ARE BOTH
 *    `required` ON THE 200. `Disposition { key, label, family, … }` lives
 *    on `SolutionPack.dispositions` and is *"minted into the tenant at
 *    install"* — and `installPack` is not mounted and no migration
 *    declares a catalogue to mint into.
 *
 * 🛑 AND NOTHING WOULD HAVE CAUGHT IT, WHICH IS WHY THIS SECTION EXISTS
 *    RATHER THAN A NOTE. G284 recorded the identical near-miss one
 *    operation over: *"`fast-json-stringify` SERIALISES WITHOUT
 *    VALIDATING, so persisting six would have shipped a response body
 *    missing three of its own required fields, silently."* A mounted
 *    `getDispositionMix` would have shipped a 200 missing two.
 * ==================================================================== */

test('5 · `getDispositionMix` declares `label` and `family` required, a table produces both, and it IS mounted', () => {
  const doc = loadTier('capability')
  const op = doc['paths']?.['/reports/disposition-mix']?.['get']
  assert.ok(op, '`getDispositionMix` has moved off `/reports/disposition-mix` — re-derive this section.')
  assert.equal(op['operationId'], 'getDispositionMix')

  /**
   * 🛑 THE FIELD LIST IS READ FROM THE CONTRACT, NEVER TYPED HERE. A
   *    hand-copied `required` list is a second declaration of the wire that
   *    drifts, which is the §5.3 shape, and it would also make this section
   *    pass after somebody quietly dropped `label` to mount the operation —
   *    the exact evasion it exists to prevent.
   */
  const required =
    op['responses']?.['200']?.['content']?.['application/json']?.['schema']?.['properties']?.['rows']?.['items']?.[
      'required'
    ]
  assert.ok(Array.isArray(required), 'the 200 row schema has no `required` list — re-derive this section')

  /** §5.6 GUARD, POSITIVE: the path above reached the real list. */
  assert.ok(
    required.includes('dispositionKey') && required.includes('count'),
    `read ${required.length} required fields and not the two every version of this report has ` +
      `carried: got [${required.join(', ')}]. The accessor chain is wrong, not the contract.`,
  )

  for (const field of ['label', 'family']) {
    assert.ok(
      required.includes(field),
      `\`${field}\` IS NO LONGER REQUIRED ON THE DISPOSITION MIX ROW.\n\n` +
        'If it was dropped in order to mount the operation, that is the wrong repair and it is ' +
        'the one this test exists to catch: the report\'s whole argument is that a disposition ' +
        'mix is reportable BECAUSE the set is closed and named — *"you cannot report a ' +
        'disposition mix over prose"* — and a row carrying a bare key with no label and no ' +
        'family is prose with extra steps. The right repair is a catalogue to read them from.',
    )
  }

  /**
   * ✅ THE PRODUCER ARRIVED ON 19 Sep 2026 — G657 — AND THIS TRIPWIRE FIRED
   *    EXACTLY AS DESIGNED. ITS OLD FORM IS QUOTED RATHER THAN DELETED,
   *    because it is the sentence four documents rest on:
   *
   *      *"THE PRODUCER, ABSENT. A disposition catalogue would be a table
   *       keyed on the disposition key holding at least `label` and `family`
   *       … Nothing in `db/migrations/` declares one, and the two places a
   *       `disposition` string is stored today are USES of a key, not
   *       declarations of one."*
   *
   *    `db/migrations/0059_resolution_chain.sql` §2 declares
   *    `tenant.disposition` — key, label, family, reversibility, terminal,
   *    requires_adjustment — so **`getDispositionMix`'s NAMED BLOCKER IS
   *    GONE**. The message below enumerated three things such a table would
   *    owe; each is answered here, and the ASSERTION IS INVERTED rather than
   *    deleted so that the table disappearing is also a red.
   *
   *      · A WRITER — **NOT TAKEN, AND REFUSED BY NAME.** `0059` grants
   *        `SELECT` and nothing else on all three reference tables, and its
   *        grants block argues it: a request path that could write this one
   *        could *mint the judgement it is about to make*. `installPack` is
   *        still unmounted; rows arrive as the migrator, which is `0015`'s
   *        own sentence about how this schema is populated.
   *      · G300's THREE PARTS — **DERIVED PER OPERATION**, on
   *        `server/data-plane/proposals.ts`'s face, for the SIX operations
   *        G656 mounts. ✅ **AND ON `server/data-plane/reports.ts`'s FACE FOR
   *        THIS ONE SINCE 20 Sep 2026.** ⚠️ THIS READ *"`getDispositionMix`
   *        IS NOT ONE OF THEM and is still not mounted; what changed is that
   *        its blocker is now a commit rather than a schema"* — and that
   *        sentence named the commit, which is G951–G954.
   *      · THE RESPONSE BODY AGAINST ITS OWN `required` LIST — done for the
   *        six, in `tests/http/proposal-chain-served.test.ts` §1, and for
   *        this one at that suite's §12, and **still owed as a GENERAL
   *        control over every mounted operation**, which is this file's own
   *        open item and is closed by neither G656 nor G951.
   *
   * 🛑 THE ASSERTION BELOW IS INVERTED RATHER THAN DELETED, FOR THE SECOND
   *    TIME ON THIS SECTION. It required the mount to be ABSENT; it now
   *    requires it to be PRESENT, so that deleting the route is a red here as
   *    well as in the served suite — and a reader arriving at C7 meets the
   *    current state rather than a refusal two commits old.
   */
  const tables = declaredTenantTables()
  assert.ok(tables.has('exception'), 'the scanner missed `tenant.exception`, which 0015 declares')

  const catalogue = [...tables].filter((t) => /disposition|solution_pack|^pack$|pack_catalogue/.test(t))
  assert.deepEqual(
    catalogue,
    ['disposition'],
    `THE DISPOSITION CATALOGUE SET HAS CHANGED (${catalogue.join(', ') || 'none'}).\n\n` +
      '  · IF IT IS EMPTY, `tenant.disposition` has been dropped and `listAvailableDispositions` ' +
      'now answers a 500 with `archetype` unprovable — G656 mounts six operations against it.\n' +
      '  · IF IT HAS GROWN, a SECOND catalogue has appeared, and `0002`\'s rule applies: two ' +
      'vocabularies for one concept, with nothing joining them. Read `0059` §2 before adding one.\n' +
      '  · EITHER WAY, the three things a catalogue owes are listed in the docblock above and ' +
      'each is answered there. A WRITER is still refused by name; `getDispositionMix` IS NOW ' +
      'MOUNTED against this table; and the general "every 200 carries every `required` field" ' +
      'control is still owed.',
  )

  /**
   * 🛑 THE MOUNT, DERIVED FROM THE SOURCE RATHER THAN ASSERTED. This file
   *    needs no database and no port, and it must not gain one — so the claim
   *    it can make about a route is that `server/data-plane/start.ts` names
   *    it. `tests/http/proposal-chain-served.test.ts` §12 is the one that
   *    proves a real plane answers.
   */
  const startSource = readFileSync(new URL('../../server/data-plane/start.ts', import.meta.url), 'utf8')
  assert.match(
    startSource,
    /^\s*getDispositionMix: authorisedHandler\(/m,
    'C7’s REPORT IS NO LONGER MOUNTED. G951–G954 mounted it on 20 Sep 2026 against G657’s ' +
      '`tenant.disposition` and `db/migrations/0140` §2’s pins; if the route is gone, this ' +
      'section’s verdict reverts and the header above must revert with it. And if it was ' +
      'removed to avoid a defect, the defect belongs in the header rather than in a deletion.',
  )
  assert.match(
    startSource,
    /reverseResolution: authorisedHandler\(/,
    '`reverseResolution` IS NO LONGER MOUNTED EITHER, and the two go together: a reversal is ' +
      'what makes `getDispositionMix`’s `reversalRate` a number rather than a constant zero.',
  )
})

/* ==================================================================== *
 * §5 · C7's EXPORT IS A DISCLOSURE SURFACE AND HAS NO STORAGE AT ALL.
 * ==================================================================== */

test('6 · `createExport` and `getExport` are declared, and nothing stores an export', () => {
  const doc = loadTier('capability')
  const create = doc['paths']?.['/exports']?.['post']
  const read = doc['paths']?.['/exports/{exportId}']?.['get']

  /** §5.6 GUARD, POSITIVE: both operations are really declared. */
  assert.equal(create?.['operationId'], 'createExport')
  assert.equal(read?.['operationId'], 'getExport')
  assert.equal(create?.[ANNOTATION_KEY], 'export_data')
  assert.equal(read?.[ANNOTATION_KEY], 'export_data')

  const tables = declaredTenantTables()
  const exportish = [...tables].filter((t) => /^export|_export$|disclosure/.test(t))
  assert.deepEqual(
    exportish,
    [],
    `AN EXPORT TABLE HAS APPEARED (${exportish.join(', ')}).\n\n` +
      'READ G472 BEFORE ADDING THE DISCLOSURE HALF. It rules that `DisclosureRecord` gets NO ' +
      'columns until something can send, because the record *"IS WRITTEN BECAUSE THE DISCLOSURE ' +
      'HAPPENED, NOT AS A LOG LINE"* — so a hand-written disclosure row is precisely the log ' +
      'line the ruling refuses. An export is the same class of act one surface over: the ' +
      'contract calls it *"A NEW COPY OF CLASSIFIED DATA"*, and it owes a `SubjectLocation` of ' +
      'kind `blob` at the moment of writing or *"ERASURE IS SILENTLY UNEXECUTABLE"*.\n\n' +
      'And invariant 4 / G106 is where an export leaks if it leaks: a JSONB key with no ' +
      '`FieldSpec` is UNREADABLE, fail-closed, and defaulting unmapped keys to the most ' +
      'sensitive class was REFUSED as scope failing OPEN. An export that ships unmapped keys ' +
      'has taken that refused default silently.',
  )
})
