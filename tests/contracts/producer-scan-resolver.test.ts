/**
 * THE COLLISION ARITHMETIC, DERIVED ON EVERY RUN — K5 of
 * `docs/build/completion-plan.md` §6, G1776–G1780, 21 Sep 2026, DERIVED AND NOT
 * THE OWNER'S.
 *
 * ┌─ WHY THIS EXISTS AS A TEST AND NOT AS A PARAGRAPH ────────────────────────┐
 * │ K5's row states the case for a resolver as three numbers: *"4 tables / 70  │
 * │ tokens ⇒ 4 of 39 common field names collide; 70 tables / 650 tokens ⇒ 19   │
 * │ of 39."* **Not one of those six figures is reproducible from anything in   │
 * │ this repository** — the population is not recorded, so the arithmetic      │
 * │ cannot be checked, only believed. A number nobody can re-derive is the     │
 * │ exact class `CLAUDE.md` catalogues twenty times over.                      │
 * │                                                                            │
 * │ **So the argument is computed rather than quoted.** If the corpus grows,   │
 * │ these figures move on their own and the section that reads them says so.   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **THE DIRECTION REPRODUCES AND EVERY ABSOLUTE FIGURE DIFFERS**, and both
 * halves of that are reported rather than reconciled. Measured on this tree,
 * 21 Sep 2026:
 *
 *     CONTROL  `db/migrations-control/`    4 tables ·  16 column names
 *     DATA     `db/migrations/`           75 tables · 370 column names
 *     console tier                                    62 required field names
 *
 *     ambiguous against CONTROL   1 of 62
 *     ambiguous against DATA      5 of 62
 *     ambiguous against BOTH      8 of 62
 *
 * **Ambiguity rises EIGHTFOLD as the corpus widens**, which is K5's claim; the
 * plan's 4-of-39 and 19-of-39 are a different population and are not this one.
 *
 * ⚠️ **AND AMBIGUITY UNDERSTATES THE PROBLEM, WHICH IS THE FINDING THIS FILE
 * ADDS TO K5's ROW (G1777).** A token on TWO tables is one the scanner cannot
 * resolve even in principle. **A token on exactly ONE table is not safety** —
 * the measured false positive that made `openByoaEscalation` look mountable was
 * `reason` on exactly one table, `onboarding_forced_step`, which has nothing to
 * do with a hosted-to-BYOA move. **So the count that matters is not *how many
 * names are ambiguous* but *how many are matched at all by a scanner that
 * cannot say WHICH table*** — and §3 measures that instead.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { sqlCode, sqlCorpus, sqlCorpusIsReal } from '../sql-code.ts'
import {
  allColumns,
  columnFor,
  relationsAreReal,
  relationsOf,
  tablesCarrying,
  type Relations,
} from '../schema-table-resolver.ts'
import { loadTier } from '../../server/contract/document.ts'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTROL_MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations-control')
const DATA_MIGRATIONS = path.join(REPO_ROOT, 'db', 'migrations')

/** Every `required` property name the console tier's `$ref` graph reaches, snake_cased. */
function consoleFieldNames(): readonly string[] {
  const doc = loadTier('platformConsole') as unknown as {
    components: { schemas: Record<string, unknown> }
    paths: Record<string, Record<string, unknown>>
  }
  const schemas = doc.components.schemas
  const out = new Set<string>()
  const walk = (node: unknown, seen: Set<string>): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((v) => walk(v, seen))
      return
    }
    const obj = node as Record<string, unknown>
    const ref = obj['$ref']
    if (typeof ref === 'string') {
      const name = /#\/components\/schemas\/([A-Za-z]+)/.exec(ref)?.[1]
      if (name !== undefined && !seen.has(name)) {
        seen.add(name)
        walk(schemas[name], seen)
      }
    }
    if (Array.isArray(obj['required'])) {
      for (const r of obj['required']) if (typeof r === 'string') out.add(r)
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'required' && k !== '$ref') walk(v, seen)
    }
  }
  for (const [, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue
      walk(op, new Set())
    }
  }
  return [...out].map(columnFor).sort()
}

describe('K5 · the collision arithmetic that argues for a resolver', () => {
  const control: Relations = relationsOf(sqlCode(sqlCorpus(CONTROL_MIGRATIONS)))
  const data: Relations = relationsOf(sqlCode(sqlCorpus(DATA_MIGRATIONS)))

  it('1 · both corpora parse into real relations, or every figure below is vacuous', () => {
    /* THE DENOMINATOR AND ITS REFUSAL. Every number in this file is a ratio over
       these two maps; parsed empty, all of them read as "no collisions" — which
       is `docs/HANDOFF.md` §5.6 wearing the vocabulary of an all-clear, and is
       the exact defect `docs/build/completion-plan.md` K4 found in five
       checkers. The floors are generous and the point is that they are not
       ZERO. */
    sqlCorpusIsReal(sqlCode(sqlCorpus(CONTROL_MIGRATIONS)), 'the control migration set')
    sqlCorpusIsReal(sqlCode(sqlCorpus(DATA_MIGRATIONS)), 'the data migration set', 10_000)
    relationsAreReal(control, 'the control migration set', 4, 6)
    relationsAreReal(data, 'the data migration set', 40, 10)

    const fields = consoleFieldNames()
    assert.ok(
      fields.length >= 40,
      `the console tier reached ${fields.length} distinct required field names, which is too ` +
        'few to be the tier. The `$ref` walk has stopped following something and every ratio ' +
        'below is computed over a population that is not the subject.',
    )

    console.log(
      `      K5 · CONTROL ${control.size} tables · ${allColumns(control).size} column names` +
        `  |  DATA ${data.size} tables · ${allColumns(data).size} column names` +
        `  |  console tier ${fields.length} required field names`,
    )
  })

  it('2 · ambiguity rises with the corpus, which is K5s claim, derived', () => {
    const fields = consoleFieldNames()
    const both: Relations = new Map([...control, ...data])

    const ambiguous = (rel: Relations): readonly string[] =>
      fields.filter((f) => tablesCarrying(rel, f).length >= 2)

    const inControl = ambiguous(control)
    const inData = ambiguous(data)
    const inBoth = ambiguous(both)

    console.log(
      `      K5 · ambiguous (a name on TWO OR MORE tables): CONTROL ${inControl.length}` +
        ` · DATA ${inData.length} · BOTH ${inBoth.length}  of ${fields.length}`,
    )
    for (const f of inBoth) {
      console.log(`           ${f}: ${tablesCarrying(both, f).length} tables`)
    }

    /**
     * 🛑 **THE SHAPE IS PINNED AND THE ABSOLUTE FIGURES ARE NOT, AND THAT IS
     * DELIBERATE — G1778.** A pinned `5` here would go red on the next
     * migration that adds a column called `version`, which is a fact about
     * `db/migrations/` and not about this argument. **What must not change
     * without somebody reading it is the ORDERING**: widening the corpus
     * strictly increases the number of names a token scanner cannot resolve.
     * If this ever fails, either the corpus shrank or the population moved, and
     * K5's whole case needs re-reading rather than the number needs bumping.
     */
    assert.ok(
      inData.length > inControl.length,
      'widening the corpus from `db/migrations-control/` to `db/migrations/` did NOT increase ' +
        'the number of console field names carried by two or more tables. **That is K5s ' +
        'entire argument, and it is derived rather than quoted precisely so it can fail.** ' +
        `CONTROL ${inControl.length}, DATA ${inData.length}, of ${fields.length}.`,
    )
    assert.ok(
      inBoth.length >= inData.length,
      'the union of both corpora is less ambiguous than the data corpus alone, which is ' +
        'arithmetically impossible unless the reader is broken.',
    )
    /* ANTI-VACUITY, and it is the assertion that would have caught a reader
       returning an empty map: a claim that NOTHING is ambiguous across 79
       tables is not a finding, it is a broken parse. */
    assert.ok(
      inBoth.length > 0,
      'no console field name is carried by two or more tables across BOTH corpora. With ' +
        `${control.size + data.size} tables that is not plausible, and an ambiguity count of ` +
        'zero makes every comparison in this file vacuous.',
    )
  })

  it('3 · what a token scanner would match, and what a resolver refuses', () => {
    /**
     * 🛑 **THIS IS THE MEASUREMENT K5's ROW DOES NOT MAKE, AND IT IS THE ONE
     * THAT DECIDES THE QUESTION — G1777.** *Ambiguous* counts names on two or
     * more tables. **The measured false positive sat on exactly ONE**, so the
     * honest figure is: how many console field names does the token scanner
     * answer YES for, on a corpus where at most one schema is resolvable?
     *
     * A resolver answers yes only for a column on the table its schema was
     * declared to come from. The gap between the two is the FALSE-POSITIVE
     * SURFACE, and it is what *"it fails toward producible"* means as a number.
     */
    const fields = consoleFieldNames()
    const both: Relations = new Map([...control, ...data])

    const scannerSaysYes = (rel: Relations): readonly string[] =>
      fields.filter((f) => tablesCarrying(rel, f).length >= 1)

    const onControl = scannerSaysYes(control)
    const onBoth = scannerSaysYes(both)

    console.log(
      `      K5 · a TOKEN SCANNER answers "producible" for ${onControl.length}/${fields.length}` +
        ` field names against CONTROL, and ${onBoth.length}/${fields.length} against BOTH` +
        ' — regardless of which table carries them',
    )

    assert.ok(
      onBoth.length > onControl.length,
      'widening the corpus did not increase the number of field names a token scanner would ' +
        'match. **This is the false-positive surface and its growth is the reason the ' +
        'producer scan may not simply be pointed at a wider corpus.** ' +
        `CONTROL ${onControl.length}, BOTH ${onBoth.length}, of ${fields.length}.`,
    )

    /**
     * ⚠️ **AND THE CONVERSE, PINNED: the resolver's answer does NOT grow with
     * the corpus, because it is not a function of the corpus.** Exactly one
     * console schema is declared to a table (`TenantSummary` ->
     * `tenancy_roster`, plus the two other tenant schemas), so widening
     * `db/migrations/` by fifty tables changes nothing it answers. That is the
     * whole of what polarity buys, stated as an assertion rather than a claim.
     */
    const roster = control.get('tenancy_roster')
    assert.ok(roster !== undefined, '`tenancy_roster` did not resolve — the reader has rotted')
    const resolvedYes = fields.filter((f) => roster.has(f))
    assert.ok(
      resolvedYes.length < onControl.length,
      'the resolver matches as many field names as the token scanner does, which would mean ' +
        'the narrowing is not narrowing. Every column of `tenancy_roster` is a token in the ' +
        'control corpus, so this can only be equal if the corpus holds exactly one table.',
    )
    console.log(
      `      K5 · a RESOLVER answers "producible" for ${resolvedYes.length}/${fields.length}` +
        ' against `tenancy_roster`, the one table a console schema is declared to',
    )
  })

  it('4 · the producer scan has NOT left the control corpus, and the judgement is recorded', () => {
    /**
     * 🛑 **K5 IS CONDITIONAL — *"a schema→table resolver IF §5a's producer scan
     * is ever to leave the control corpus"* — AND THIS SLICE BUILDS THE
     * RESOLVER AND DOES NOT WIDEN THE SCAN. G1779, and the plan forbids the
     * widening by name: *"Do not point its scanner at `db/migrations/`."***
     *
     * **The judgement, recorded so the next slice inherits it rather than
     * re-deriving it:**
     *
     *   · **The BLOCKER is removed.** The reason a wider corpus was unsafe is
     *     that the scan failed toward *producible*, and every one of the 19
     *     collisions §2 counts becomes a potential false "mountable". A
     *     resolver answers from ONE declared table, so corpus size stops being
     *     a variable in the verdict at all — §3 asserts exactly that.
     *
     *   · **The WORK is not done, and it is not small.** Widening means a
     *     schema→table entry for every schema every tier reaches, across 136
     *     operations and seven documents, each a decision somebody has to
     *     defend. An unmapped schema resolves to `null` and reports
     *     unproducible, which is SAFE and UNINFORMATIVE — a scan that says
     *     "no" about everything has the same output as one nobody ran.
     *
     *   · **And the corpus question is not one question.** A tenant-database
     *     table cannot produce a field for a CONSOLE operation at any price
     *     (G831: two databases, and the console act's transaction is a session
     *     scope). So *"which corpus"* is per-tier, not global, and getting it
     *     wrong in the permissive direction manufactures exactly the
     *     coincidences this slice removed.
     *
     * **This test is what makes the non-widening a fact rather than an
     * intention.**
     */
    const consoleSuite = readFileSync(
      path.join(REPO_ROOT, 'tests', 'http', 'console-roster-unreachable.test.ts'),
      'utf8',
    )
    assert.ok(
      consoleSuite.includes('CONTROL_MIGRATIONS'),
      '§5a no longer reads the control migration set at all — the producer scan has moved and ' +
        'this assertion is describing a file that has changed.',
    )
    assert.ok(
      !/relationsOf\(\s*sqlCode\(\s*sqlCorpus\(\s*MIGRATIONS\s*\)/.test(consoleSuite),
      '**§5a now resolves against `db/migrations/`, which `docs/build/completion-plan.md` §6 ' +
        'forbids by name for this scan.** K5 builds the RESOLVER; widening the corpus is a ' +
        'separate act with its own red, and it owes a per-TIER answer to which database an ' +
        'operation could read — a tenant table cannot produce a console field at any price ' +
        '(G831). If this was deliberate, delete this assertion and argue it where §5a lives.',
    )

    /* AND THE FILE COUNT OF THE CORPUS ITSELF, so "the control corpus" cannot
       quietly become a different set of files. */
    const controlFiles = readdirSync(CONTROL_MIGRATIONS).filter((f) => f.endsWith('.sql'))
    assert.ok(
      controlFiles.length >= 4,
      `the control migration directory holds ${controlFiles.length} file(s), which is fewer ` +
        'than the four tables this section is computed over.',
    )
  })
})
