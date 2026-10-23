/**
 * A SCHEMA→TABLE RESOLVER — K5 of `docs/build/completion-plan.md` §6.
 *
 * G1771–G1776, 21 Sep 2026, DERIVED AND NOT THE OWNER'S.
 *
 * ┌─ WHAT IT REPLACES, AND WHY THE REPLACEMENT IS ABOUT DIRECTION ────────────┐
 * │ `tests/http/console-roster-unreachable.test.ts` §5a asks, for every        │
 * │ `required` response field an unmounted operation declares, *"is there a    │
 * │ column of this name?"* — and it asks it of a CONCATENATED CORPUS:          │
 * │                                                                            │
 * │     new RegExp(`\\b${columnFor(p)}\\b`).test(control)                      │
 * │                                                                            │
 * │ That is a token test, not a resolution. It cannot tell a column ON THE     │
 * │ TABLE THIS SCHEMA COMES FROM from a column of the same name on a table     │
 * │ with nothing to do with it — and **it fails toward *"producible"***, which │
 * │ is the wrong direction for this particular question: a field wrongly       │
 * │ called producible is an operation that looks mountable, and mounting it    │
 * │ ships a 200 missing its own `required` field.                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **THE FAILURE IS MEASURED AND IT ALREADY HAPPENED — §5a CAUGHT IT ON
 *    ITSELF AND HELD THE OPERATION OUT BY NAME BECAUSE IT HAD NO WAY TO FIX
 *    IT.** `openByoaEscalation`'s only `required` field is
 *    `ByoaEscalationRequest.reason`; `db/migrations-control/0030_onboarding_
 *    record.sql` added a `reason` column to `onboarding_forced_step`, a table
 *    about H2's delivery sequence with nothing whatever to do with a
 *    hosted-to-BYOA move. **The operation went from unproducible to producible
 *    on 20 Sep 2026 without anybody building it anything.** Witnessed again
 *    before this file was written, by emptying that hold-out and running §5a:
 *
 *        Producible: [listTenants, openByoaEscalation].
 *        Still short of a producer (12): …
 *
 *    That is at **FOUR TABLES**.
 *
 * 🛑 **AND THE ARITHMETIC IS WHY THE HOLD-OUT DOES NOT SCALE.** Re-derived on
 *    this tree rather than quoted — `tests/contracts/producer-scan-resolver.test.ts`
 *    recomputes all of it every run, so these figures cannot rot in place:
 *
 *      · `db/migrations-control/`  **4** tables, **16** distinct column names
 *      · `db/migrations/`         **75** tables, **372** distinct column names
 *      · console tier             **62** distinct `required` field names
 *
 *      · against the CONTROL corpus  **1** of 62 names sits on two or more tables
 *      · against the DATA corpus     **5** of 62
 *      · against BOTH                **8** of 62
 *
 *    ⚠️ **THOSE ARE NOT `completion-plan.md` §6's FIGURES AND THE DIFFERENCE IS
 *    REPORTED RATHER THAN RECONCILED.** K5's row states *"4 tables / 70 tokens
 *    ⇒ 4 of 39 common field names collide; 70 tables / 650 tokens ⇒ 19 of 39"*.
 *    The DIRECTION reproduces — ambiguity rises eightfold as the corpus widens
 *    — and every absolute figure differs, because this derivation counts
 *    distinct COLUMN NAMES declared by `CREATE TABLE`/`ADD COLUMN` and the
 *    distinct `required` property names the tier's `$ref` graph actually
 *    reaches. **The plan's population is not recorded anywhere, so it cannot be
 *    reproduced and is not claimed here.** The test derives; do not read either
 *    set of numbers.
 *
 * ⚠️ **WHAT A RESOLVER BUYS IS NOT PRECISION, IT IS POLARITY.** A schema that
 * resolves to no table is UNPRODUCIBLE — fail-closed, which is `0001`'s
 * deny-on-NULL and G106's unreadable-by-default, applied to a scanner. A token
 * that happens to exist somewhere can no longer make an operation look ready.
 * **The cost is named: an unmapped schema reports unproducible for a reason
 * about THIS FILE rather than about the tree**, so every entry is a decision
 * and the map is required to be TOTAL over the schemas its caller walks.
 *
 * ⚠️ **IT IS STILL A SCANNER AND NOT A PARSER, IN THE SAME WORDS §5a AND
 * `tools/check-wire-mirror.mjs` BOTH USE.** It reads `CREATE TABLE` bodies by
 * matching parentheses and `ALTER TABLE … ADD COLUMN` by name. It does not
 * evaluate `CREATE TABLE … LIKE`, `INHERITS`, `AS SELECT`, a `DROP COLUMN` or
 * a `RENAME`. G88 makes migrations forward-only, and no migration in this tree
 * does any of those — **that is a fact about the corpus, not a property of this
 * reader**, and `relationsAreReal()` below is what should notice when it stops
 * being true.
 */

import assert from 'node:assert/strict'

/**
 * camelCase -> snake_case. The correspondence `tests/db/tenancy-roster.test.ts`
 * writes and `tests/http/console-roster-unreachable.test.ts` §5 asserts against.
 *
 * ⚠️ IT IS DECLARED HERE SO THE TWO CALLERS SHARE ONE, which is `0002`'s
 * *"a third place to drift"* applied to a helper: the version §5a carried and
 * the version `tests/db/` carried were the same three characters twice, and
 * two copies of one correspondence is the shape `docs/HANDOFF.md` §5.3 names.
 */
export function columnFor(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/** Every table a migration corpus declares, as `name -> column names`. */
export type Relations = ReadonlyMap<string, ReadonlySet<string>>

/**
 * ⚠️ A TABLE-CONSTRAINT LINE IS NOT A COLUMN, AND TAKING ONE FOR A COLUMN IS
 * THE FAILURE DIRECTION THIS WHOLE FILE EXISTS TO CLOSE. `CONSTRAINT
 * onboarding_record_completed_is_a_prefix_length CHECK (…)` would otherwise
 * contribute a `constraint` column and `PRIMARY KEY (tenant_id, step)` a
 * `primary` one — both of which would make some field somewhere producible on
 * the strength of a keyword.
 */
const TABLE_CONSTRAINT_KEYWORDS: ReadonlySet<string> = new Set([
  'PRIMARY',
  'FOREIGN',
  'UNIQUE',
  'CHECK',
  'CONSTRAINT',
  'EXCLUDE',
  'LIKE',
  'INHERITS',
])

function addColumn(fragment: string, into: Set<string>): void {
  const trimmed = fragment.trim()
  if (trimmed === '') return
  const first = /^"?(\w+)"?/.exec(trimmed)
  if (first === null) return
  const name = first[1] ?? ''
  if (TABLE_CONSTRAINT_KEYWORDS.has(name.toUpperCase())) return
  into.add(name)
}

/**
 * Parse a migration corpus into relations.
 *
 * 🛑 THE CALLER MUST PASS SQL THAT HAS ALREADY BEEN THROUGH `sqlCode()`.
 * `tests/sql-code.ts` records at length what a comment does to an absence read
 * off raw text — §4a asserting no onboarding column existed while the token sat
 * in a comment REFUSING one. The same defect here is worse and quieter: a
 * commented-out `CREATE TABLE` in a migration that explains a rejected
 * alternative would furnish this map with a table nobody built, and every field
 * on it would read as producible.
 */
export function relationsOf(strippedSql: string): Relations {
  const out = new Map<string, Set<string>>()

  const create =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w.]*|"[^"]+"|\w+\."[^"]+")\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = create.exec(strippedSql)) !== null) {
    const name = (m[1] ?? '').replace(/"/g, '')
    /* Balanced-parenthesis scan rather than a lazy `\)`: a column list carries
       `numeric(12, 2)` and `CHECK (a OR (b AND c))`, and the first `)` is
       almost never the last one. */
    let depth = 1
    let i = create.lastIndex
    while (i < strippedSql.length && depth > 0) {
      const ch = strippedSql[i]
      if (ch === '(') depth += 1
      else if (ch === ')') depth -= 1
      i += 1
    }
    const body = strippedSql.slice(create.lastIndex, i - 1)

    const columns = new Set<string>()
    let nested = 0
    let current = ''
    for (const ch of body) {
      if (ch === '(') nested += 1
      if (ch === ')') nested -= 1
      if (ch === ',' && nested === 0) {
        addColumn(current, columns)
        current = ''
      } else current += ch
    }
    addColumn(current, columns)
    out.set(name, columns)
  }

  /* A column added to another migration's table — `0011_federated_connection.sql`
     is the first, and there are many. Omitting these would under-report the
     corpus, which fails toward "unproducible" and is the SAFE direction, but it
     would also make `db/migrations/0012`'s `confidence_floor` invisible and the
     map wrong about a table it does hold. */
  for (const alter of strippedSql.matchAll(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][\w.]*|\w+\."[^"]+")\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi,
  )) {
    const table = (alter[1] ?? '').replace(/"/g, '')
    const column = alter[2] ?? ''
    const existing = out.get(table)
    if (existing === undefined) out.set(table, new Set([column]))
    else existing.add(column)
  }

  return out
}

/**
 * THE GUARD EVERY CALLER OWES, WRITTEN ONCE — `tests/sql-code.ts`'s
 * `sqlCorpusIsReal()` one layer up, for the same reason and with the same
 * polarity.
 *
 * A resolution read off an EMPTY map is free: every schema resolves to nothing,
 * every field is unproducible, and the caller's assertion passes having checked
 * nothing. That is `docs/HANDOFF.md` §5.6 — and it is a sharper risk here than
 * for the token scanner it replaces, because this reader fails CLOSED. A broken
 * regex makes the token scanner loud and makes this one silent.
 *
 * ⚠️ TWO FLOORS, NOT ONE, AND THE SECOND IS THE ONE THAT BITES. A corpus can
 * parse into the right NUMBER of tables with every column list empty — which is
 * exactly what a mis-scanned parenthesis produces — so the widest table must
 * also be checked for width.
 */
export function relationsAreReal(
  relations: Relations,
  what: string,
  minTables: number,
  minWidestTable: number,
): void {
  assert.ok(
    relations.size >= minTables,
    `${what}: parsed ${relations.size} table(s) against a floor of ${minTables}. This resolver ` +
      'fails CLOSED — every field of an unresolved schema reads as unproducible — so an empty ' +
      'or thin map is a GREEN run that checked nothing. Either the corpus did not load, or ' +
      '`relationsOf()` stopped recognising a `CREATE TABLE` form. Fix the reader; do not ' +
      'lower this floor.',
  )
  const widest = Math.max(0, ...[...relations.values()].map((c) => c.size))
  assert.ok(
    widest >= minWidestTable,
    `${what}: the widest table parsed to ${widest} column(s) against a floor of ` +
      `${minWidestTable}. A corpus can parse into the right NUMBER of tables with every ` +
      'column list empty, which is what a mis-scanned parenthesis produces and which reads ' +
      'as "no schema produces anything" rather than as a broken reader.',
  )
}

/**
 * Does the table this schema resolves to carry this property's column?
 *
 * 🛑 `table === null` IS THE FAIL-CLOSED ARM AND IT IS THE POINT OF THE FILE.
 * A schema with no declared table produces nothing, whatever tokens happen to
 * exist elsewhere in the corpus.
 */
export function resolves(relations: Relations, table: string | null, property: string): boolean {
  if (table === null) return false
  return relations.get(table)?.has(columnFor(property)) === true
}

/**
 * How many tables carry each token — the collision arithmetic, derived.
 *
 * `0` is absent, `1` is unambiguous and `>= 2` is a token the TOKEN SCANNER
 * cannot resolve even in principle. ⚠️ **A COUNT OF `1` IS NOT SAFETY**: the
 * `reason` coincidence sat on exactly one table. Ambiguity measures how far the
 * scanner is from being able to work at all; a resolver is needed at `1` too.
 */
export function tablesCarrying(relations: Relations, token: string): readonly string[] {
  return [...relations.entries()].filter(([, cols]) => cols.has(token)).map(([t]) => t)
}

/** Every distinct column name in a corpus — the denominator of the arithmetic above. */
export function allColumns(relations: Relations): ReadonlySet<string> {
  return new Set([...relations.values()].flatMap((c) => [...c]))
}
