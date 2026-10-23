// RED — intentionally failing on creation.
//
// Witnesses four ways `parseDbSchemaFrom` can print an RLS badge the migrations
// do not implement, or refuse a migration for the wrong reason:
//
//   #164 defect 1 — a multi-action ALTER is judged by its first action only, so
//                   DISABLE / NO FORCE / DROP COLUMN ride in behind ADD COLUMN.
//   #164 defect 2 — the schema qualifier is optional, so one bare
//                   `ALTER TABLE tenant ENABLE ROW LEVEL SECURITY` in 0001
//                   enables RLS on every same-named table in every schema.
//   #166          — comments are stripped line-leading only, and string
//                   literals are not lexed at all, so a note about future work
//                   is read as evidence of present fact.
//   #143 S-2      — `CREATE FUNCTION` with a dollar-quoted body is shredded by
//                   the `;` split and the migration is refused for the wrong
//                   reason.
//
// Companion to tests/tools/schema-scanner-vocabulary.test.mjs, which this suite
// does not modify. Every fixture here is one the vocabulary suite cannot see.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseDbSchemaFrom, lexer } from '../../tools/planner/extract-c4-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The real 0001. Enables and FORCEs RLS on `tenant` and `tenant_contact` with BARE names (:131-134). */
const M0001 = readFileSync(join(ROOT, 'db', 'migrations', '0001_tenancy_and_rls.sql'), 'utf8')

/**
 * NON-VACUITY GUARD. Every assertion below is about what the scanner did or did
 * not find in a corpus it actually read. A scan of nothing finds nothing, and
 * "no false badge" over zero tables is not a pass.
 */
function scan(files) {
  const parsed = parseDbSchemaFrom(files)
  assert.equal(
    parsed.parsedFrom.length,
    Object.keys(files).length,
    'every fixture file must have been scanned, or the finding count proves nothing',
  )
  assert.ok(parsed.tables.length > 0, 'the scan must have produced tables, or it compared nothing')
  return parsed
}

const find = (parsed, schema, name) => parsed.tables.find((t) => t.schema === schema && t.name === name)

/** A control-plane table under its own schema, spelled multi-line as the CREATE TABLE matcher requires. */
const controlTable = (name) => `CREATE TABLE control.${name} (\n  id uuid PRIMARY KEY,\n  status text NOT NULL\n);\n`

const CONTROL_SCHEMA = 'CREATE SCHEMA control;\n'

/**
 * A SECURITY DEFINER function of the shape the owner's S-2 ruling puts into a
 * migration (#143). THE BODY CONTAINS SEMICOLONS — that is the whole point.
 */
const FUNCTION_DOLLAR = `CREATE FUNCTION control.current_session_id() RETURNS text AS $$
BEGIN
  PERFORM 1;
  RETURN current_setting('app.session_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

/** The same function with a TAGGED dollar quote. `$$` is not the only spelling. */
const FUNCTION_TAGGED = `CREATE FUNCTION control.current_session_id() RETURNS text AS $fn$
BEGIN
  PERFORM 1;
  RETURN current_setting('app.session_id', true);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
`

// =====================================================================
// #164 DEFECT 1 — a statement is judged by EVERY action, not the first.
// =====================================================================

describe('schema scanner — a multi-action ALTER is judged by all of its actions', () => {
  it('REFUSES an ALTER that hides DISABLE and NO FORCE behind a recognised ADD COLUMN', () => {
    const attack = `
ALTER TABLE tenant
  ADD COLUMN residency text NOT NULL DEFAULT 'sg',
  DISABLE ROW LEVEL SECURITY,
  NO FORCE ROW LEVEL SECURITY;
`
    assert.throws(
      () => parseDbSchemaFrom({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': attack }),
      /does not/i,
      'an ALTER that disables RLS must never be the thing that slipped past — ' +
        'accepted today, and the page then prints RLS ENABLED · FORCED for a table with neither',
    )
  })

  it('REFUSES an ALTER that hides NO FORCE alone behind a recognised ADD COLUMN', () => {
    const attack = `ALTER TABLE tenant ADD COLUMN residency text, NO FORCE ROW LEVEL SECURITY;`
    assert.throws(
      () => parseDbSchemaFrom({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': attack }),
      /does not/i,
      'NO FORCE is refused as a lone statement by the vocabulary suite; hiding it ' +
        'behind ADD COLUMN must not buy it entry',
    )
  })

  it('REFUSES an ALTER that hides DROP COLUMN behind a recognised ADD COLUMN', () => {
    const attack = `ALTER TABLE tenant ADD COLUMN residency text, DROP COLUMN name;`
    assert.throws(
      () => parseDbSchemaFrom({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': attack }),
      /does not/i,
      'the trailing DROP COLUMN is invisible today, so the page keeps listing a column ' +
        'the migration removed',
    )
  })

  it('REFUSES an ALTER that hides OWNER TO behind a recognised ADD COLUMN', () => {
    // A table's owner may disable RLS on it. 0001:190 revokes CREATE on schema
    // public precisely so reconcile_app can own nothing; an OWNER TO smuggled
    // into an action list undoes that with the page none the wiser.
    const attack = `ALTER TABLE tenant ADD COLUMN residency text, OWNER TO reconcile_app;`
    assert.throws(
      () => parseDbSchemaFrom({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': attack }),
      /does not/i,
      'OWNER TO is not a recognised action and must refuse wherever it appears in the list',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: `$`-anchoring the RECOGNISED_DDL entries, or refusing
  // any ALTER containing a comma. Either one refuses every legitimate
  // multi-action migration — including the ADD COLUMN forms #143 exists to
  // permit — and turns an over-report into a hard gate failure at check:counts.
  it('still ACCEPTS an ALTER whose every action is recognised', () => {
    const legit = `
ALTER TABLE tenant ADD COLUMN residency text NOT NULL DEFAULT 'sg', ADD COLUMN region text;
ALTER TABLE tenant_contact ADD COLUMN locale text, ADD CONSTRAINT tenant_contact_locale_ck CHECK (locale <> '');
`
    const parsed = scan({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': legit })
    const tenant = find(parsed, 'public', 'tenant')
    assert.ok(tenant, 'public.tenant must still parse')
    assert.ok(
      tenant.columns.some((c) => c.name === 'residency'),
      'the legitimate multi-action ADD COLUMN must still be rendered, not merely tolerated',
    )
    assert.equal(tenant.rlsEnabled, true, 'and nothing in it removes RLS')
  })

  // ---- POSITIVE CONTROL ----
  // The single-action form is what #143 landed. Narrowing must not blind it.
  it('still ACCEPTS and renders a single-action ADD COLUMN', () => {
    const ok = `ALTER TABLE tenant ADD COLUMN residency text NOT NULL DEFAULT 'sg';`
    const parsed = scan({ '0001_tenancy_and_rls.sql': M0001, '0002_split.sql': ok })
    const tenant = find(parsed, 'public', 'tenant')
    assert.ok(tenant.columns.some((c) => c.name === 'residency'), 'the column must render')
    assert.equal(tenant.rlsEnabled, true)
    assert.equal(tenant.rlsForced, true)
  })
})

// =====================================================================
// #164 DEFECT 2 — RLS binds to a TABLE, not to a bare name.
// =====================================================================

describe('schema scanner — RLS binds to a table, not to a bare name', () => {
  it('does NOT claim RLS on control.tenant, which no statement enables', () => {
    const parsed = scan({
      '0001_tenancy_and_rls.sql': M0001,
      '0003_control.sql': CONTROL_SCHEMA + controlTable('tenant') + controlTable('tenant_contact'),
    })
    // Non-vacuity: the same parse must still find the badge where it is real.
    assert.equal(find(parsed, 'public', 'tenant').rlsEnabled, true, 'the matcher must be live')

    const claimed = find(parsed, 'control', 'tenant')
    assert.ok(claimed, 'control.tenant must be parsed, or this proves nothing')
    assert.equal(
      claimed.rlsEnabled,
      false,
      "0001:131's bare `ALTER TABLE tenant ENABLE ROW LEVEL SECURITY` resolves via search_path " +
        'to public.tenant and says nothing about any other schema',
    )
    assert.equal(
      claimed.rlsForced,
      false,
      'rlsForced must be falsifiable too — no test in the tree has ever asserted it false',
    )

    const contact = find(parsed, 'control', 'tenant_contact')
    assert.ok(contact, 'control.tenant_contact must be parsed')
    assert.equal(contact.rlsEnabled, false, 'the same collision, on the table M0-2 also creates')
    assert.equal(contact.rlsForced, false)
  })

  it('does NOT let a QUALIFIED enable leak to a same-named table in another schema', () => {
    const parsed = scan({
      '0003_control.sql':
        CONTROL_SCHEMA +
        controlTable('audit') +
        'ALTER TABLE control.audit ENABLE ROW LEVEL SECURITY;\n' +
        'ALTER TABLE control.audit FORCE  ROW LEVEL SECURITY;\n',
      '0004_archive.sql': 'CREATE SCHEMA archive;\nCREATE TABLE archive.audit (\n  id uuid PRIMARY KEY\n);\n',
    })
    // Non-vacuity: the enable that IS real must read true in the same parse.
    assert.equal(find(parsed, 'control', 'audit').rlsEnabled, true)
    assert.equal(find(parsed, 'control', 'audit').rlsForced, true)

    const other = find(parsed, 'archive', 'audit')
    assert.ok(other, 'archive.audit must be parsed')
    assert.equal(other.rlsEnabled, false, 'a qualified reference names exactly one table')
    assert.equal(other.rlsForced, false)
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: making the schema qualifier MANDATORY. 0001 enables
  // RLS with bare names, so a mandatory qualifier flips public.tenant and
  // public.tenant_contact to false — an UNDER-report, which loses the only
  // positive enforcement invariant 3 has.
  it('still reads 0001’s real BARE enables on the public tables', () => {
    const parsed = scan({ '0001_tenancy_and_rls.sql': M0001 })
    for (const name of ['tenant', 'tenant_contact']) {
      const t = find(parsed, 'public', name)
      assert.ok(t, `public.${name} must parse`)
      assert.equal(t.rlsEnabled, true, `0001 genuinely enables RLS on public.${name}`)
      assert.equal(t.rlsForced, true, `0001 genuinely FORCEs RLS on public.${name}`)
    }
  })

  // ---- POSITIVE CONTROL ----
  // ENABLE and FORCE are two independent facts. A fix that binds the two
  // patterns to one another — or that resolves FORCE by falling back to the
  // ENABLE match — prints `FORCED` for a table that only has ENABLE.
  it('reports rlsForced FALSE for a table that is enabled but never forced', () => {
    const parsed = scan({
      '0003_control.sql':
        CONTROL_SCHEMA + controlTable('registry') + 'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n',
    })
    const t = find(parsed, 'control', 'registry')
    assert.equal(t.rlsEnabled, true, 'the ENABLE is real')
    assert.equal(t.rlsForced, false, 'nothing forces it, and FORCE is what subjects the owner to the policy')
  })
})

// =====================================================================
// #166 — a comment is not a statement, and a literal is not SQL.
// =====================================================================

/** A registry no statement ever enables RLS on, beside a ledger that one genuinely does. */
const PENDING = CONTROL_SCHEMA + controlTable('registry') + controlTable('ledger') +
  'ALTER TABLE control.ledger ENABLE ROW LEVEL SECURITY;\n'

/** Non-vacuity for every comment case: the real enable beside it must still read true. */
function assertLedgerStillEnabled(parsed) {
  assert.equal(
    find(parsed, 'control', 'ledger').rlsEnabled,
    true,
    'the genuine enable in the same corpus must still be found, or "false" is vacuous',
  )
}

describe('schema scanner — a comment is not a statement', () => {
  it('ignores a TRAILING comment on a statement line', () => {
    const sql = PENDING +
      'GRANT SELECT ON control.registry TO reconcile_app; -- ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY later\n'
    const parsed = scan({ '0003_control.sql': sql })
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'a note recording that RLS is NOT YET done is being read as evidence that it is',
    )
  })

  it('ignores a comment INSIDE a CREATE TABLE body', () => {
    const sql = CONTROL_SCHEMA + controlTable('ledger') +
      'ALTER TABLE control.ledger ENABLE ROW LEVEL SECURITY;\n' +
      'CREATE TABLE control.registry (\n' +
      '  id uuid PRIMARY KEY,  -- ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY\n' +
      '  status text NOT NULL\n' +
      ');\n'
    const parsed = scan({ '0003_control.sql': sql })
    assertLedgerStillEnabled(parsed)
    const registry = find(parsed, 'control', 'registry')
    assert.ok(registry, 'the table must still parse through its own comment')
    assert.equal(
      registry.rlsEnabled,
      false,
      'a trailing comment on a column definition is ordinary SQL style, not a statement',
    )
  })

  it('accepts a BLOCK comment and reads nothing from it', () => {
    const sql = PENDING + '/* still to do, tracked on #146:\n' +
      '   ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n' +
      ' */\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0003_control.sql': sql })
    }, '/* … */ is legal PostgreSQL and is not stripped at all today, so the migration is REFUSED')
    assertLedgerStillEnabled(parsed)
    assert.equal(find(parsed, 'control', 'registry').rlsEnabled, false, 'a block comment is not a statement')
  })

  it('reads nothing from SQL spelled inside a STRING LITERAL', () => {
    // COMMENT ON is a RECOGNISED statement, so nothing refuses here — the
    // literal simply leaks into the RLS matcher and the badge turns on.
    const sql = PENDING +
      "COMMENT ON TABLE control.registry IS 'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY is still to come';\n"
    const parsed = scan({ '0003_control.sql': sql })
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'a string literal is data. The scanner is reading a table comment as DDL',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: widening the stripper to /--.*$/gm. That deletes
  // from `--` onward inside `'a -- b'`, swallowing the real ALTER that follows
  // it on the next lines — an UNDER-report on a genuinely protected table.
  it('does NOT treat a -- inside a string literal as starting a comment', () => {
    const sql = CONTROL_SCHEMA +
      'CREATE TABLE control.registry (\n' +
      '  id uuid PRIMARY KEY,\n' +
      "  note text NOT NULL DEFAULT 'a -- b'\n" +
      ');\n' +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n' +
      'ALTER TABLE control.registry FORCE  ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0003_control.sql': sql })
    const t = find(parsed, 'control', 'registry')
    assert.ok(t.columns.some((c) => c.name === 'note'), 'the column carrying the literal must render')
    assert.equal(t.rlsEnabled, true, 'the literal must not swallow the real ALTER that follows it')
    assert.equal(t.rlsForced, true)
  })

  // ---- POSITIVE CONTROL ----
  // A literal is not SQL, but the statement AROUND it is still judged. An
  // unrecognised statement must refuse — for itself, never silently.
  //
  // ⚠️ AMENDED 19 Sep 2026 — S-21. THIS TEST USED `INSERT INTO` AS ITS
  //    UNRECOGNISED STATEMENT AND `INSERT INTO` IS NOW RECOGNISED, for
  //    `UPDATE`'s reason: `db/migrations/0008_staff_grant_selection.sql` seeds
  //    four governance reference tables, and an insert on an ordinary table
  //    changes ROWS while this page depicts SCHEMA. The old body was:
  //
  //        assert.throws(() => parseDbSchemaFrom({ … INSERT INTO control.audit
  //          (note) VALUES ('ALTER TABLE … ENABLE ROW LEVEL SECURITY') … }),
  //          /INSERT INTO/i, 'the refusal must name the INSERT itself')
  //
  // 🛑 THE PROPERTY IS NOT WEAKENED, IT IS SPLIT IN TWO AND BOTH HALVES GET A
  //    WITNESS — and the first half is STRONGER than what stood here, because
  //    recognising a statement form is exactly when "SQL in a literal must not
  //    be read as DDL" starts to matter. Before, the INSERT never reached the
  //    matchers at all; now it does, and the badge must still stay off.
  it('reads nothing from DDL spelled inside a RECOGNISED statement`s string literal', () => {
    const sql = PENDING +
      "INSERT INTO control.audit(note) VALUES ('ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY');\n"
    const parsed = scan({ '0003_control.sql': sql })
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'RECOGNISING `INSERT INTO` TURNED A STRING LITERAL INTO DDL. A literal is data. If ' +
        'this is red, the cost of admitting the statement form is a page that prints `RLS ' +
        'ENABLED · FORCED` for a table with neither — the exact failure ' +
        '`refuseUnrecognisedDdl` exists to prevent, arriving through the door that was ' +
        'opened to let a seed through.',
    )
  })

  it('still REFUSES an unrecognised statement that happens to carry SQL in a literal', () => {
    // `DELETE FROM` is the unrecognised statement now: it is genuinely not in
    // RECOGNISED_DDL, and unlike the INSERT above it has no legitimate use in a
    // migration this scanner has met.
    const sql = PENDING +
      "DELETE FROM control.audit WHERE note = 'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY';\n"
    assert.throws(
      () => parseDbSchemaFrom({ '0003_control.sql': sql }),
      /DELETE FROM/i,
      'the refusal must name the DELETE itself',
    )
  })

  // ---- POSITIVE CONTROL ----
  // 🛑 AND THE ONE THE NEGATIVE LOOKAHEAD EXISTS FOR. `UPDATE`'s entry refuses a
  //    system catalogue by name, because `UPDATE pg_class SET relrowsecurity =
  //    false` turns RLS off by writing the catalogue directly and the page would
  //    keep printing the badge. `INSERT INTO` carries the identical lookahead and
  //    it is asserted rather than assumed — a copied regex is a regex nobody read.
  it('REFUSES an INSERT into a system catalogue, qualified or bare', () => {
    for (const target of ['pg_policy', 'pg_catalog.pg_policy', 'information_schema.tables']) {
      assert.throws(
        () => parseDbSchemaFrom({ '0003_control.sql': PENDING + `INSERT INTO ${target}(x) VALUES (1);\n` }),
        /INSERT INTO/i,
        `an INSERT into \`${target}\` was accepted. A migration has no business writing a ` +
          'system catalogue, and one that does can change what this page depicts without ' +
          'changing a single statement the page reads.',
      )
    }
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: stripping comments AFTER splitting on `;`, or any
  // rewrite that forgets the line-leading case that already works.
  it('still strips a LINE-LEADING comment', () => {
    const sql = PENDING + '-- ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY\n'
    const parsed = scan({ '0003_control.sql': sql })
    assertLedgerStillEnabled(parsed)
    assert.equal(find(parsed, 'control', 'registry').rlsEnabled, false)
  })

  // ---- POSITIVE CONTROL ----
  // 0001 is the only migration in the tree and it is dense with comments. Any
  // change to what "stripped" means must leave its parse BYTE-FOR-BYTE where it
  // is, or docs/c4-data.json and docs/c4.html move under check:c4.
  it('leaves 0001’s parse unchanged — re-derived, not assumed', () => {
    const parsed = scan({ '0001_tenancy_and_rls.sql': M0001 })
    const projection = {
      schemas: parsed.schemas,
      tables: parsed.tables,
      policies: parsed.policies,
      grants: parsed.grants,
    }
    assert.deepEqual(projection, JSON.parse(PARSE_OF_0001))
  })
})

// =====================================================================
// #143 S-2 — a dollar-quoted function body is OPAQUE.
// =====================================================================

describe('schema scanner — a dollar-quoted CREATE FUNCTION body is opaque', () => {
  it('ACCEPTS a CREATE FUNCTION whose $$ body contains semicolons', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + FUNCTION_DOLLAR +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0005_session_fn.sql': sql })
    }, 'the `;` split shreds the body into fragments matching nothing, so the migration is REFUSED for the wrong reason')
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      true,
      'and the statements AROUND the function must still be read',
    )
  })

  it('ACCEPTS a CREATE FUNCTION with a TAGGED $fn$ body', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + FUNCTION_TAGGED +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0005_session_fn.sql': sql })
    }, '$$ is not the only spelling of a dollar quote')
    assert.equal(find(parsed, 'control', 'registry').rlsEnabled, true)
  })

  it('reads no DDL out of the function BODY', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + controlTable('ledger') +
      'ALTER TABLE control.ledger ENABLE ROW LEVEL SECURITY;\n' +
      'CREATE FUNCTION control.note() RETURNS void AS $$\n' +
      'BEGIN\n' +
      "  RAISE NOTICE 'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY';\n" +
      'END;\n' +
      '$$ LANGUAGE plpgsql;\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0005_session_fn.sql': sql })
    }, 'the function must be accepted before its body can be shown to be inert')
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'a function body is opaque: it is neither scanned as DDL nor matched for RLS',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: treating everything from the first `$$` as opaque, or
  // whitelisting any statement that contains one. The refusal must still fire
  // for what follows the function, and must NAME that statement rather than the
  // function fragments it is shredding today.
  it('still REFUSES an unrecognised statement that FOLLOWS a function body', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + FUNCTION_DOLLAR + 'DROP TABLE control.registry;\n'
    assert.throws(
      () => parseDbSchemaFrom({ '0005_session_fn.sql': sql }),
      (err) => {
        assert.match(err.message, /DROP TABLE control\.registry/, 'the refusal must name the DROP')
        assert.doesNotMatch(
          err.message,
          /CREATE FUNCTION/,
          'and must NOT name the function — today the body is shredded into four fragments and ' +
            'the migration is refused for the wrong reason',
        )
        return true
      },
    )
  })

  it('still REFUSES a DISABLE that follows a function body', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n' +
      FUNCTION_DOLLAR + 'ALTER TABLE control.registry DISABLE ROW LEVEL SECURITY;\n'
    assert.throws(
      () => parseDbSchemaFrom({ '0005_session_fn.sql': sql }),
      (err) => {
        assert.match(
          err.message,
          /ALTER TABLE control\.registry DISABLE ROW LEVEL SECURITY/,
          'the refusal must name the DISABLE',
        )
        assert.doesNotMatch(err.message, /CREATE FUNCTION/, 'and must not blame the function')
        return true
      },
    )
  })
})

// =====================================================================
// F1 — A FILE THIS SCANNER CANNOT FULLY READ IS A REFUSAL, NOT A SWALLOW.
//
// The lexer has four states that consume a delimited run: `'…'`, `"…"`,
// `$tag$…$tag$`, and `/* … */`. ALL FOUR run to end-of-file when the closing
// delimiter never arrives, and end-of-file is not an error to any of them.
// Everything after the opening delimiter therefore becomes ONE statement whose
// leading keyword is the one before it — recognised, so `refuseUnrecognisedDdl`
// passes it — and the dispatch's `if (!m) continue` then renders nothing from
// it. A DROP SCHEMA, a DROP TABLE or a DISABLE hidden in that tail is silently
// erased and the page keeps printing `RLS ENABLED · FORCED`.
//
// The realistic one is the first: a typo'd dollar tag on the CREATE FUNCTION
// form the owner's S-2 ruling requires, with a DROP SCHEMA behind it.
//
// ⚠️ THERE IS NO "already correct" CASE AMONG THE FOUR. The single-quote path
// refuses only when the merged statement's leading keyword happens to be
// unrecognised (`INSERT INTO …`, or a literal opening a statement). Behind
// `COMMENT ON`, `GRANT`, `CREATE POLICY`, `CREATE TABLE` or `ADD COLUMN` — every
// place a literal actually appears — it fails open exactly like the others.
// =====================================================================

/** What the swallow is hiding. Refused loudly when the file around it is readable. */
const TAIL_DISABLE_AND_DROP =
  'ALTER TABLE tenant_contact DISABLE ROW LEVEL SECURITY;\n' + 'DROP TABLE tenant_contact;\n'

/** Every fixture below bundles the real 0001, so the swallowed tail has a live badge to falsify. */
const withTenancy = (attack) => ({ '0001_tenancy_and_rls.sql': M0001, '0002_attack.sql': attack })

/**
 * The file could not be read, so it must be refused BY NAME. A scanner that
 * cannot find the end of a statement cannot claim to have read the ones after it.
 */
function refusesAsUnreadable(attack, what) {
  assert.throws(
    () => parseDbSchemaFrom(withTenancy(attack)),
    (err) => {
      assert.match(err.message, /0002_attack\.sql/, `the refusal must name the file (${what})`)
      assert.match(
        err.message,
        /unterminated|unclosed|does not/i,
        `the refusal must say the file could not be fully read (${what})`,
      )
      return true
    },
    `${what}: accepted today — the tail is swallowed into one recognised statement and rendered as nothing`,
  )
}

describe('schema scanner — an unterminated delimiter is refused, not consumed to EOF', () => {
  // ---- NON-VACUITY ----
  // The tail every fixture in this block hides is refused loudly when nothing
  // hides it. If this case ever stopped throwing, every assertion below would be
  // proving that a no-op was not detected.
  it('refuses the hidden tail outright when no broken delimiter conceals it', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy(TAIL_DISABLE_AND_DROP)),
      /DISABLE ROW LEVEL SECURITY/,
      'the DISABLE is what the swallow is hiding, and it is refused when visible',
    )
  })

  it('REFUSES a MISMATCHED dollar tag — $a$ opened, $b$ closed — hiding a DROP SCHEMA', () => {
    // The realistic case. `CREATE FUNCTION` is recognised under S-2, so the
    // remainder of the file joins it as one accepted statement and the
    // DROP SCHEMA is never seen by anything.
    refusesAsUnreadable(
      'CREATE FUNCTION public.current_session_id() RETURNS text AS $a$\n' +
        'BEGIN\n' +
        "  RETURN current_setting('app.session_id', true);\n" +
        'END;\n' +
        '$b$ LANGUAGE plpgsql SECURITY DEFINER;\n' +
        'DROP SCHEMA public;\n',
      'mismatched dollar tag',
    )
  })

  it('REFUSES an UNTERMINATED dollar-quoted body hiding a DISABLE and a DROP TABLE', () => {
    refusesAsUnreadable(
      'CREATE FUNCTION public.current_session_id() RETURNS text AS $$\n' +
        'BEGIN\n' +
        '  RETURN 1;\n' +
        'END;\n' +
        'LANGUAGE plpgsql;\n' +
        TAIL_DISABLE_AND_DROP,
      'unterminated dollar-quoted body',
    )
  })

  it('REFUSES an UNTERMINATED block comment hiding a DISABLE and a DROP TABLE', () => {
    // Worse than the others in one way: the block-comment branch blanks what it
    // consumed, so the tail does not merely go unrendered — it leaves no trace
    // in any statement at all.
    refusesAsUnreadable('/* a note that never closes\n' + TAIL_DISABLE_AND_DROP, 'unterminated block comment')
  })

  it('REFUSES an UNTERMINATED string literal behind a recognised keyword', () => {
    refusesAsUnreadable(
      "COMMENT ON TABLE tenant IS 'a note that never closes\n" + TAIL_DISABLE_AND_DROP,
      'unterminated string literal',
    )
  })

  it('REFUSES an UNTERMINATED quoted identifier behind a recognised keyword', () => {
    refusesAsUnreadable(
      'COMMENT ON TABLE tenant IS "a note that never closes\n' + TAIL_DISABLE_AND_DROP,
      'unterminated quoted identifier',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: "throw on any unmatched delimiter" computed by counting
  // occurrences. A legitimate `$$ … $$` body is the form #143 S-2 exists to permit
  // and it must still parse, with the statements around it still read.
  it('still ACCEPTS a legitimate $$ body and reads the statements around it', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + FUNCTION_DOLLAR +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0005_session_fn.sql': sql })
    assert.equal(find(parsed, 'control', 'registry').rlsEnabled, true)
  })

  it('still ACCEPTS a legitimate TAGGED $fn$ body', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + FUNCTION_TAGGED +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0005_session_fn.sql': sql })
    assert.equal(find(parsed, 'control', 'registry').rlsEnabled, true)
  })

  // ---- POSITIVE CONTROL ----
  // Block comments NEST in PostgreSQL and the scanner counts depth to say so.
  // Nothing in the tree exercised the nesting until now: a mutant that stops at
  // the first `*/` survived the whole suite, which means the depth counter was
  // advertised and unverified.
  it('still ACCEPTS a NESTED block comment and reads what follows it', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      '/* outer /* inner */ still inside the outer comment */\n' +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0006_nested.sql': sql })
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      true,
      'the inner `*/` must not end the outer comment — everything after it would ' +
        'then be read as SQL, and the real ALTER after it lost',
    )
  })

  // ---- POSITIVE CONTROL ----
  // The `"…"` state had zero coverage: deleting it flips a genuinely protected
  // table to rls=false, and the suite stayed green.
  it('still reads RLS through a QUOTED IDENTIFIER', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      'ALTER TABLE "control"."registry" ENABLE ROW LEVEL SECURITY;\n' +
      'ALTER TABLE "control"."registry" FORCE ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0007_quoted.sql': sql })
    const t = find(parsed, 'control', 'registry')
    assert.equal(t.rlsEnabled, true, 'a quoted identifier names the same table as a bare one')
    assert.equal(t.rlsForced, true)
  })
})

// =====================================================================
// F1(b) — `E'…'` IS A FAIL-OPEN HAZARD, NOT AN UNRENDERED FORM.
//
// The source called `E'…'` "not handled, deliberately", in the same breath as
// forms that are merely unrendered. It is not that: PostgreSQL honours a
// backslash-escaped `\'` inside an E-string, and `closeQuote` ends at the first
// undoubled `'`. So ONE ordinary E-string puts every following `;` inside a
// phantom literal, and `refuseUnrecognisedDdl` never sees those statements at
// all. Both directions occur — a swallowed ENABLE under-reports, an E-string in
// a CREATE POLICY over-reports — and the second case below is #164 defect 1
// still alive: valid PostgreSQL that carries a DISABLE past the action judge.
//
// `U&'…'` needs nothing: it doubles quotes like an ordinary literal. A plain
// `'…\'…'` is a PostgreSQL syntax error, and the scanner's reading of it is
// coincidentally the same as PostgreSQL's. The hole is exactly one form.
// =====================================================================

describe("schema scanner — an E'…' literal honours backslash escapes", () => {
  it('REFUSES a DROP POLICY and DROP TABLE that follow an E-string', () => {
    refusesAsUnreadable(
      "COMMENT ON TABLE tenant IS E'o\\'clock';\n" +
        'DROP POLICY tenant_rls ON tenant;\n' +
        'DROP TABLE tenant_contact;\n',
      'E-string swallowing two DROPs',
    )
  })

  it('REFUSES a DISABLE hidden in an action list behind a DEFAULT E-string', () => {
    // Valid PostgreSQL, and the one DISABLE variant that still walks through the
    // per-action judge: the `\'` re-opens a literal that eats the comma, so the
    // action list is never split and the DISABLE is never judged.
    assert.throws(
      () => parseDbSchemaFrom(withTenancy("ALTER TABLE tenant ADD COLUMN x text DEFAULT E'a\\'b', DISABLE ROW LEVEL SECURITY;\n")),
      /DISABLE ROW LEVEL SECURITY|unterminated/i,
      'an ALTER that disables RLS must never be the thing that slipped past',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: refusing every E-string, or treating `\` as an escape
  // in ordinary literals too. An E-string is legal and the statements around it
  // must still be read.
  it('still ACCEPTS a legitimate E-string and reads the statements after it', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      "COMMENT ON TABLE control.registry IS E'o\\'clock';\n" +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    const parsed = scan({ '0008_estring.sql': sql })
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      true,
      'the ENABLE after the E-string is real and must not be swallowed',
    )
  })

  it('reads no DDL out of an E-string body', () => {
    const sql = PENDING +
      "COMMENT ON TABLE control.registry IS E'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY \\'later\\'';\n"
    const parsed = scan({ '0008_estring.sql': sql })
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'an escape-string literal is data, exactly like an ordinary one',
    )
  })
})

// =====================================================================
// F2 — THE ALTER ACTION LISTS MUST MATCH POSTGRESQL'S GRAMMAR.
//
// `SET SCHEMA` is NOT an item in `ALTER TABLE name action [, …]`. It is its own
// command form, and `ALTER TABLE t ADD COLUMN c text, SET SCHEMA s` is a syntax
// error PostgreSQL rejects outright. The scanner accepted it and ACTED on it —
// relocating public.tenant to control.tenant, a plane-split relocation behind a
// benign first line, from a statement that could never have run.
//
// And the removal rule's stated property is DISCLOSURE — the removal named on
// the line a refusal quotes and `git log -p` shows — but the predicate keyed on
// SOLITUDE, so a statement that discloses the removal FIRST was refused anyway.
// =====================================================================

describe('schema scanner — ALTER action lists follow the grammar, not the fixtures', () => {
  it('REFUSES a multi-action ALTER containing SET SCHEMA, and does not relocate the table', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN residency text, SET SCHEMA control;\n')),
      /does not|not a list action|SET SCHEMA/i,
      'SET SCHEMA is not a list action; accepted today, and public.tenant silently ' +
        'becomes control.tenant behind a benign ADD COLUMN',
    )
  })

  it('ACCEPTS a removal that DISCLOSES itself first, and applies both actions', () => {
    const parsed = scan(withTenancy('ALTER TABLE tenant DROP COLUMN status, ADD COLUMN residency text;\n'))
    const tenant = find(parsed, 'public', 'tenant')
    assert.ok(tenant, 'public.tenant must still parse')
    assert.equal(
      tenant.columns.some((c) => c.name === 'status'),
      false,
      'the disclosed DROP COLUMN must be applied, not refused — the statement opens by naming it',
    )
    assert.ok(
      tenant.columns.some((c) => c.name === 'residency'),
      'and the ADD COLUMN beside it must be applied too',
    )
    assert.equal(tenant.rlsEnabled, true, 'and nothing in it touches RLS')
  })

  // ---- POSITIVE CONTROL ----
  // The solitary SET SCHEMA is the whole of the plane-split slice's relocation
  // vocabulary. Narrowing SET SCHEMA to a command form must not lose it.
  it('still ACCEPTS a solitary SET SCHEMA and relocates the table', () => {
    const parsed = scan({
      '0001_tenancy_and_rls.sql': M0001,
      '0002_split.sql': CONTROL_SCHEMA + 'ALTER TABLE tenant SET SCHEMA control;\n',
    })
    assert.ok(find(parsed, 'control', 'tenant'), 'tenant must have moved into schema control')
    assert.equal(find(parsed, 'public', 'tenant'), undefined, 'and must not remain in public')
    assert.equal(
      find(parsed, 'control', 'tenant').rlsEnabled,
      true,
      'RLS is a property of the table and survives the move',
    )
  })
})

// =====================================================================
// F3 — A BARE REFERENCE RESOLVES TO `public`, OR IT RESOLVES TO NOTHING.
//
// `findTable`'s `matches.length === 1` fallback bound a bare reference to a
// table that is not in `public` — a statement PostgreSQL would reject, since
// nothing puts `control` on the search_path. Worse, the fallback is SORT-ORDER
// DEPENDENT: the same statements give control.registry rls=true or rls=false
// depending only on whether the file creating a same-named public table sorts
// before or after. This file's header makes determinism a hard requirement.
// =====================================================================

describe('schema scanner — a bare reference resolves to public or to nothing', () => {
  it('does NOT bind a bare reference to a lone table outside public', () => {
    const attack = CONTROL_SCHEMA + controlTable('registry') +
      'ALTER TABLE registry ENABLE ROW LEVEL SECURITY;\n'
    assert.throws(
      () => parseDbSchemaFrom({ '0003_control.sql': attack }),
      /does not|unresolvable|resolves to no/i,
      'a bare `registry` resolves through search_path to public.registry, which does ' +
        'not exist — this statement errors in PostgreSQL, and binding it to the one ' +
        'lucky match prints a protection nothing enabled',
    )
  })

  it('does not depend on the order the files sort in', () => {
    // The same two statements, with the public table created AFTER the bare
    // reference instead of before. Under the single-match fallback the badge
    // flips on file name alone.
    const late = {
      '0003_control.sql': CONTROL_SCHEMA + controlTable('registry') +
        'ALTER TABLE registry ENABLE ROW LEVEL SECURITY;\n',
      '0004_public.sql': 'CREATE TABLE registry (\n  id uuid PRIMARY KEY,\n  status text NOT NULL\n);\n',
    }
    assert.throws(
      () => parseDbSchemaFrom(late),
      /does not|unresolvable|resolves to no/i,
      'at the point the bare reference is written, no public.registry exists yet — ' +
        'the binding rule is temporal and must not reach forward to a later file',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Refuses the blunt fix: refusing every bare reference. 0001 enables RLS with
  // bare names, and a bare name must still bind to the public table when one is
  // there — including when a same-named table exists in another schema.
  it('still binds a bare reference to the public table, and only to it', () => {
    const parsed = scan({
      '0003_control.sql': CONTROL_SCHEMA + controlTable('registry'),
      '0004_public.sql': 'CREATE TABLE registry (\n  id uuid PRIMARY KEY,\n  status text NOT NULL\n);\n' +
        'ALTER TABLE registry ENABLE ROW LEVEL SECURITY;\n',
    })
    assert.equal(find(parsed, 'public', 'registry').rlsEnabled, true, 'the bare reference names public.registry')
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'and says nothing about the same-named table in another schema',
    )
  })

  // ---- POSITIVE CONTROL ----
  // A table enabled by a bare name in 0001 and relocated later keeps the fact.
  // That is the whole reason the binding is to the OBJECT and not to the name.
  it('still lets a bare-name enable survive a later SET SCHEMA', () => {
    const parsed = scan({
      '0001_tenancy_and_rls.sql': M0001,
      '0002_split.sql': CONTROL_SCHEMA + 'ALTER TABLE tenant_contact SET SCHEMA control;\n',
    })
    const moved = find(parsed, 'control', 'tenant_contact')
    assert.ok(moved, 'tenant_contact must survive the move')
    assert.equal(moved.rlsEnabled, true, 'RLS enablement travels with the table')
    assert.equal(moved.rlsForced, true)
  })
})

// =====================================================================
// F1 — A `$` INSIDE AN IDENTIFIER DOES NOT OPEN A DOLLAR QUOTE.
//
// `dollarTag` never looked at the character to its LEFT. PostgreSQL permits `$`
// inside an identifier after the first character (`ident_cont` is
// `[A-Za-z\200-\377_0-9\$]`) and its lexer takes the LONGEST match, so `a$q$` is
// ONE identifier and never a tag opener. The scanner opened a body at the first
// `a$q$` and closed it at the next `b$q$`, swallowing every statement between —
// verified against a real PostgreSQL 14.18 cluster, where the migration below
// applies cleanly and leaves `relrowsecurity = f`, no `tenant_contact`, and zero
// rows in `pg_policy`, while the page went on printing `RLS ENABLED · FORCED`
// for both tables and listing both policies.
//
// `quotedRun` already carries exactly this guard for `E'…'` — the `E` in
// `…source_tablee'x'` is part of the identifier, not an escape-string opener —
// so this is one rule stated twice, not two rules.
//
// The mirror of the same root cause: `$é$` DOES open in PostgreSQL, because
// `ident_start` is `[A-Za-z\200-\377_]` and every byte of a non-ASCII character's
// UTF-8 encoding lies in `\200-\377`. The scanner's ASCII-only class refused it —
// an OVER-refusal, safe, but the same defect pointing the other way.
// =====================================================================

/** The PostgreSQL 14.18-verified attack. Both `$q$` are inside identifiers. */
const PHANTOM_DOLLAR =
  'ALTER TABLE tenant ADD COLUMN a$q$ text;\n' +
  'ALTER TABLE tenant DISABLE ROW LEVEL SECURITY;\n' +
  'ALTER TABLE tenant NO FORCE ROW LEVEL SECURITY;\n' +
  'DROP POLICY tenant_rls ON tenant;\n' +
  'DROP TABLE tenant_contact;\n' +
  'ALTER TABLE tenant ADD COLUMN b$q$ int;\n'

/** A function body tagged with a NON-ASCII tag, which PostgreSQL accepts. */
const FUNCTION_ACCENTED =
  'CREATE FUNCTION control.note() RETURNS void AS $é$\n' +
  'BEGIN\n' +
  "  RAISE NOTICE 'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY';\n" +
  'END;\n' +
  '$é$ LANGUAGE plpgsql;\n'

describe('schema scanner — a `$` inside an identifier is not a dollar-quote opener', () => {
  it('REFUSES the phantom dollar-quote, naming the DISABLE and the DROP it swallowed', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy(PHANTOM_DOLLAR)),
      (err) => {
        assert.match(
          err.message,
          /DISABLE ROW LEVEL SECURITY/,
          'the DISABLE is the statement the phantom body swallowed, and the refusal must name it',
        )
        assert.match(err.message, /DROP TABLE tenant_contact/, 'and the DROP TABLE behind it')
        return true
      },
      'accepted today: `a$q$` opens a body that closes at `b$q$`, so four statements — a DISABLE, ' +
        'a NO FORCE, a DROP POLICY and a DROP TABLE — vanish and the page keeps printing RLS ENABLED · FORCED',
    )
  })

  // ---- LEXER, DIRECTLY ----
  // Three rounds of defects have now been in unexported lexer code that a fully
  // passing suite could not see. These assert the rule itself, not a downstream
  // consequence of it.
  it('does not open a tag on a `$` that CONTINUES an identifier', () => {
    assert.equal(lexer.dollarTag('a$q$', 1), null, '`a$q$` is ONE identifier — longest match wins')
    assert.equal(lexer.dollarTag('tenant$1$', 6), null)
    assert.equal(
      lexer.dollarTag('AS$$SELECT 1$$', 2),
      null,
      '`AS$$SELECT 1$$` is a PostgreSQL syntax error, and `AS$$` is why',
    )
    assert.equal(lexer.dollarTag('AS $$SELECT 1$$', 3), '$$', 'with a space it succeeds, and so must this')
    assert.equal(lexer.dollarTag('$$x$$', 0), '$$', 'a tag at the start of the text has nothing to its left')
    assert.equal(lexer.dollarTag('($$x$$', 1), '$$', 'and a `(` does not continue an identifier')
  })

  // ---- T2 ----
  // The tag's CLOSING `$` is what makes `dollarTag` safe to test at every
  // position: without it `$1` and `$foo ` become tags, and the scanner opens a
  // body on a positional parameter.
  it('requires the tag’s CLOSING `$`', () => {
    assert.equal(lexer.dollarTag('$', 0), null)
    assert.equal(lexer.dollarTag('$1', 0), null, 'a positional parameter is not a tag')
    assert.equal(lexer.dollarTag('$foo bar$', 0), null, 'an unterminated tag is not a tag')
    assert.equal(lexer.dollarTag('$foo$bar$foo$', 0), '$foo$', 'and a terminated one is')
  })

  it('opens a tag on a NON-ASCII ident_start, exactly as PostgreSQL does', () => {
    assert.equal(lexer.dollarTag('$é$', 0), '$é$', "`ident_start` is [A-Za-z\\200-\\377_], so `é` opens")
    assert.equal(lexer.dollarTag('$é$body$é$', 0), '$é$')
    assert.equal(lexer.dollarTag('$1é$', 0), null, 'but a DIGIT still cannot start a tag')
  })

  it('ACCEPTS a function body under a non-ASCII tag, and reads no DDL out of it', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') + controlTable('ledger') +
      'ALTER TABLE control.ledger ENABLE ROW LEVEL SECURITY;\n' + FUNCTION_ACCENTED
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0009_accented.sql': sql })
    }, '$é$ is a legal dollar tag; refusing it shreds the body on its `;` and blames the function')
    assertLedgerStillEnabled(parsed)
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      false,
      'and the body stays opaque — neither scanned as DDL nor matched for RLS',
    )
  })

  // ---- POSITIVE CONTROL ----
  // The guard must not close the door on the form #143 S-2 exists to permit.
  it('still ACCEPTS `AS $$ … $$` and `AS $fn$ … $fn$` written with whitespace', () => {
    for (const [name, body] of [['dollar', FUNCTION_DOLLAR], ['tagged', FUNCTION_TAGGED]]) {
      const parsed = scan({
        '0005_session_fn.sql': CONTROL_SCHEMA + controlTable('registry') + body +
          'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n',
      })
      assert.equal(find(parsed, 'control', 'registry').rlsEnabled, true, `the ${name} body must still parse`)
    }
  })
})

// =====================================================================
// F2 — THE ACTION LIST IS A LIST, AND A MALFORMED ONE IS A REFUSAL.
//
// `splitTopLevelCommas` decremented `depth` without a floor, so ONE stray `)`
// drove it to -1 and every subsequent comma stopped being top-level. The action
// list was then never split, the smuggled action was never judged, and
// `ALTER TABLE tenant ADD COLUMN x text), DISABLE ROW LEVEL SECURITY` was
// ACCEPTED. The `SET SCHEMA` and `DROP COLUMN` variants ride in the same way.
//
// The comma-less form is the same class by another route: `ADD COLUMN x text
// DISABLE ROW LEVEL SECURITY` is ONE action to the splitter and the ADD COLUMN
// pattern's open tail whitelists whatever follows.
//
// PostgreSQL rejects every shape below, so no such migration ever ran. That is
// exactly why they matter: the source claims "valid SQL refused, never invalid
// SQL acted upon", and each of these is invalid SQL acted upon.
// =====================================================================

describe('schema scanner — a malformed ALTER action list refuses rather than degenerates', () => {
  // ---- P3 ----
  it('REFUSES a DISABLE hidden behind an unbalanced `)`', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text), DISABLE ROW LEVEL SECURITY;\n')),
      /DISABLE ROW LEVEL SECURITY/,
      'a stray `)` drives the splitter to depth -1 and the comma stops splitting, so the ' +
        'DISABLE is never judged and the page keeps printing RLS ENABLED · FORCED',
    )
  })

  it('REFUSES a SET SCHEMA hidden behind an unbalanced `)`, and does not relocate the table', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text), SET SCHEMA control;\n')),
      /SET SCHEMA|not a list action|does not/i,
      'the same depth underflow carries a plane-split relocation past the action judge',
    )
  })

  it('REFUSES a DROP COLUMN hidden behind an unbalanced `)`', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text), DROP COLUMN status;\n')),
      /DROP COLUMN|does not/i,
      'a removal behind an ADD COLUMN is not disclosed, and the `)` hides even that it is there',
    )
  })

  it('REFUSES a DISABLE smuggled into an action with NO COMMA AT ALL', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text DISABLE ROW LEVEL SECURITY;\n')),
      /DISABLE ROW LEVEL SECURITY|does not/i,
      "the ADD COLUMN pattern's open tail whitelists an arbitrary remainder, so a second " +
        'action needs no comma to ride in',
    )
  })

  it('REFUSES an OWNER TO smuggled into an action with no comma', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text OWNER TO reconcile_app;\n')),
      /OWNER TO|does not/i,
      'a table owner may disable RLS on it; 0001 revokes CREATE on public precisely so that ' +
        'reconcile_app owns nothing',
    )
  })

  // ---- A5 ----
  // `parseAlterTable` returns null for an ALTER it cannot read as
  // `ALTER TABLE name action [, …]`, and `isRecognisedStatement` turns that into
  // a refusal. Nothing exercised that branch: making it `return true` instead
  // survived the whole suite.
  it('REFUSES an ALTER TABLE with no action list at all', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant;\n')),
      /does not/i,
      'an ALTER this scanner cannot parse as a list of actions has no actions it can judge',
    )
  })

  it('REFUSES an ALTER TABLE whose action list is empty', () => {
    assert.throws(() => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant , ;\n')), /does not/i)
  })

  it('REFUSES an action left unbalanced by a stray `)` even with nothing behind it', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN x text);\n')),
      /does not/i,
      'PostgreSQL rejects it outright, and a scanner that acts on invalid SQL depicts a ' +
        'database that cannot exist',
    )
  })

  // ---- D3 ----
  // `DROP COLUMN` is `$`-anchored so the recognised form is exactly the one the
  // scanner can APPLY. Unpinning it accepts `DROP COLUMN status CASCADE`, whose
  // cascade this scanner cannot follow — dependent objects vanish from the
  // database and stay on the page.
  it('REFUSES a DROP COLUMN carrying a tail the scanner cannot apply', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant DROP COLUMN status CASCADE;\n')),
      /does not/i,
      'CASCADE drops dependent objects this scanner never sees',
    )
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant DROP COLUMN status RESTRICT;\n')),
      /does not/i,
    )
  })

  // ---- L5 ----
  // The `ADD COLUMN` pattern requires a NAME and then something after it. Both
  // halves matter: without them `ADD COLUMN` alone, and `ADD COLUMN residency`
  // with no type, are accepted as recognised actions and applied as nothing.
  it('REFUSES an ADD COLUMN that names no column, or names one with no type', () => {
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN;\n')),
      /does not/i,
      'ADD COLUMN with nothing after it is not a column definition',
    )
    assert.throws(
      () => parseDbSchemaFrom(withTenancy('ALTER TABLE tenant ADD COLUMN residency;\n')),
      /does not/i,
      'a column with no type is refused rather than applied as a column with no type',
    )
  })

  // ---- POSITIVE CONTROL ----
  // Every narrowing above must leave the legitimate forms alone.
  it('still ACCEPTS the legitimate ADD COLUMN and ADD CONSTRAINT forms', () => {
    const legit =
      "ALTER TABLE tenant ADD COLUMN residency text NOT NULL DEFAULT 'sg', ADD COLUMN region text;\n" +
      "ALTER TABLE tenant ADD COLUMN locale text CHECK (locale <> ''), ADD CONSTRAINT tenant_region_ck CHECK (region <> '');\n" +
      'ALTER TABLE tenant_contact ADD COLUMN channel_note text REFERENCES tenant (id) ON DELETE CASCADE;\n'
    const parsed = scan(withTenancy(legit))
    const tenant = find(parsed, 'public', 'tenant')
    assert.deepEqual(
      ['residency', 'region', 'locale'].filter((c) => tenant.columns.some((x) => x.name === c)),
      ['residency', 'region', 'locale'],
      'every legitimate ADD COLUMN must still render',
    )
    assert.equal(tenant.rlsEnabled, true)
    assert.equal(tenant.rlsForced, true)
  })

  it('still ACCEPTS a solitary DROP COLUMN and a disclosed one', () => {
    const parsed = scan(withTenancy('ALTER TABLE tenant DROP COLUMN status;\n'))
    assert.equal(
      find(parsed, 'public', 'tenant').columns.some((c) => c.name === 'status'),
      false,
      'the plain DROP COLUMN form must still be applied',
    )
  })
})

// =====================================================================
// F3 — THE LEXER IS TESTED AS A LEXER.
//
// Eight mutations survived a fully green 932-test suite and FIVE of them sat in
// `quotedRun`, `closeQuote`, `dollarTag` and `splitTopLevelCommas` — every one
// asserted in prose and reachable only through `parseDbSchemaFrom`. Three
// consecutive rounds of defects have now been in exactly that code. The cases
// below drive the lexer directly, so a rule that is stated is also checked.
// =====================================================================

describe('schema scanner — the lexer, driven directly', () => {
  // ---- Q4 ----
  // `"…"` is the THIRD opener and both existing "quoted identifier" tests pass
  // for the wrong reason: deleting the branch leaves them green because the
  // statements they contain refuse for other reasons.
  it('recognises all THREE openers — `\'…\'`, `"…"` and `E\'…\'`', () => {
    assert.deepEqual(lexer.quotedRun("'a'", 0), { end: 3, kind: 'string literal', closer: "'" })
    assert.deepEqual(lexer.quotedRun('"a"', 0), { end: 3, kind: 'quoted identifier', closer: '"' })
    assert.deepEqual(lexer.quotedRun("E'a'", 0), { end: 4, kind: 'escape-string literal', closer: "'" })
    assert.equal(lexer.quotedRun('a', 0), null)
    assert.equal(lexer.quotedRun("tablee'a'", 5), null, 'a trailing `e` on an identifier is not an E-string opener')
  })

  it('lexes a QUOTED IDENTIFIER containing an apostrophe as one run', () => {
    // A `"` run that is not lexed leaves the `'` inside it to open a literal,
    // which then runs past the ALTER that follows and swallows it.
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      `COMMENT ON COLUMN control.registry."o'clock" IS 'a quoted identifier may contain an apostrophe';\n` +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0010_quoted_ident.sql': sql })
    }, 'the `"…"` run must be consumed as one token')
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      true,
      'the ENABLE after the quoted identifier is real and must not be swallowed',
    )
  })

  // ---- Q3 ----
  // `closeQuote`'s `backslashEscapes` is false everywhere except `E'…'`, and the
  // source says so in a comment no test checks. Honouring `\` in an ordinary
  // literal swallows the rest of the file exactly the way the E-string bug did.
  it('honours backslash escapes ONLY inside an E-string', () => {
    assert.equal(lexer.closeQuote("'a\\'", 0, "'", false), 4, "a standard literal `'a\\'` ENDS at that quote")
    assert.equal(lexer.closeQuote("'a\\'", 0, "'", true), -1, 'an E-string with the same bytes never closes')
    assert.equal(lexer.closeQuote("E'a\\'b'", 1, "'", true), 7, "and a `\\'` inside one is a quote, not an end")
    assert.equal(lexer.closeQuote("'a''b'", 0, "'", false), 6, "and `''` escapes in both")
    assert.equal(lexer.closeQuote("'a", 0, "'", false), -1, 'an unterminated run reports -1, never text.length')
  })

  it('does NOT read a backslash as an escape in an ORDINARY literal', () => {
    const sql = CONTROL_SCHEMA + controlTable('registry') +
      "COMMENT ON TABLE control.registry IS 'a backslash \\';\n" +
      'ALTER TABLE control.registry ENABLE ROW LEVEL SECURITY;\n'
    let parsed
    assert.doesNotThrow(() => {
      parsed = scan({ '0011_backslash.sql': sql })
    }, "with standard_conforming_strings on, `'a \\'` ends at that quote and the statement ends at the `;`")
    assert.equal(
      find(parsed, 'control', 'registry').rlsEnabled,
      true,
      'reading the backslash as an escape re-opens the literal and eats the ALTER after it',
    )
  })

  // ---- P1 / P3 ----
  // The splitter's quote awareness is asserted at length in a comment and
  // exercised by nothing: deleting the `quotedRun` branch leaves the suite green.
  it('splits on commas at top level only — quotes, dollar bodies and parens are opaque', () => {
    assert.deepEqual(lexer.splitTopLevelCommas('a, b'), ['a', ' b'])
    assert.deepEqual(lexer.splitTopLevelCommas("a 'x,y', b"), ["a 'x,y'", ' b'], 'a comma in a literal is data')
    assert.deepEqual(lexer.splitTopLevelCommas('a "x,y", b'), ['a "x,y"', ' b'], 'and one in an identifier')
    assert.deepEqual(lexer.splitTopLevelCommas("a E'x\\',y', b"), ["a E'x\\',y'", ' b'], 'and one behind a `\\\'`')
    assert.deepEqual(lexer.splitTopLevelCommas('a $q$x,y$q$, b'), ['a $q$x,y$q$', ' b'], 'and one in a dollar body')
    assert.deepEqual(lexer.splitTopLevelCommas('a (x, y), b'), ['a (x, y)', ' b'], 'and one inside parens')
  })

  it('clamps paren depth at zero, so a stray `)` cannot swallow every later comma', () => {
    assert.deepEqual(
      lexer.splitTopLevelCommas('a), b'),
      ['a)', ' b'],
      'unclamped, depth goes to -1 and no comma is ever top-level again',
    )
    assert.deepEqual(lexer.splitTopLevelCommas('a)), b, c'), ['a))', ' b', ' c'])
  })

  it('is the same lexer `scanSql` uses — statements split on the OUTSIDE state only', () => {
    assert.deepEqual(lexer.scanSql('SELECT 1; SELECT 2;'), ['SELECT 1;', 'SELECT 2;'])
    assert.deepEqual(lexer.scanSql("SELECT ';';"), ["SELECT ';';"], 'a `;` in a literal is not a terminator')
    assert.deepEqual(lexer.scanSql('SELECT $$;$$;'), ['SELECT $$;$$;'], 'nor one in a dollar body')
    assert.deepEqual(lexer.scanSql('SELECT a$q$; SELECT 2;'), ['SELECT a$q$;', 'SELECT 2;'], 'nor is `a$q$` a tag')
  })
})

/**
 * The parse of `db/migrations/0001_tenancy_and_rls.sql` as re-derived on
 * `codex/issue-143-schema-scanner`, before any fix in this slice. Committed as a
 * literal so the control is a comparison against a recorded value rather than
 * against whatever the code happens to produce.
 */
const PARSE_OF_0001 =
  '{"schemas":["public"],"tables":[{"schema":"public","name":"tenant","source":"0001_tenancy_and_rls.sql",' +
  '"columns":[{"name":"id","type":"text","notNull":true,"primaryKey":true,"default":"","references":""},' +
  '{"name":"name","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"account_id","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"status","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"created_at","type":"timestamptz","notNull":true,"primaryKey":false,"default":"now()","references":""}],' +
  '"constraints":[],"rlsEnabled":true,"rlsForced":true},' +
  '{"schema":"public","name":"tenant_contact","source":"0001_tenancy_and_rls.sql",' +
  '"columns":[{"name":"tenant_id","type":"text","notNull":true,"primaryKey":false,"default":"","references":"tenant(id)"},' +
  '{"name":"id","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"duty","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"contact_order","type":"integer","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"address","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"channel","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"data_class","type":"text","notNull":true,"primaryKey":false,"default":"","references":""},' +
  '{"name":"holder_name","type":"text","notNull":false,"primaryKey":false,"default":"","references":""},' +
  '{"name":"verified_at","type":"timestamptz","notNull":false,"primaryKey":false,"default":"","references":""},' +
  '{"name":"verification_expires_at","type":"timestamptz","notNull":false,"primaryKey":false,"default":"","references":""}],' +
  '"constraints":["PRIMARY KEY (tenant_id, id)"],"rlsEnabled":true,"rlsForced":true}],' +
  '"policies":[{"name":"tenant_contact_rls","table":"tenant_contact","source":"0001_tenancy_and_rls.sql",' +
  '"using":"tenant_id = nullif(current_setting(\'app.tenant_id\', true), \'\')",' +
  '"withCheck":"tenant_id = nullif(current_setting(\'app.tenant_id\', true), \'\')"},' +
  '{"name":"tenant_rls","table":"tenant","source":"0001_tenancy_and_rls.sql",' +
  '"using":"id = nullif(current_setting(\'app.tenant_id\', true), \'\')",' +
  '"withCheck":"id = nullif(current_setting(\'app.tenant_id\', true), \'\')"}],' +
  '"grants":[{"privileges":"USAGE","on":"SCHEMA public","to":"reconcile_app","source":"0001_tenancy_and_rls.sql"},' +
  '{"privileges":"SELECT, INSERT, UPDATE, DELETE","on":"tenant","to":"reconcile_app","source":"0001_tenancy_and_rls.sql"},' +
  '{"privileges":"SELECT, INSERT, UPDATE, DELETE","on":"tenant_contact","to":"reconcile_app","source":"0001_tenancy_and_rls.sql"}]}'
