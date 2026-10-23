// RED — intentionally failing on creation.
//
// ⚠️ THAT LINE IS THE FILE'S ORIGIN AND NOT ITS CURRENT STATE, and it is left
// standing rather than deleted because the second RED wave landed under it:
// the expand/contract block below was added on 16 Aug 2026 and witnessed
// failing 4/20 before `tools/planner/extract-c4-data.mjs` was touched.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseDbSchemaFrom } from '../../tools/planner/extract-c4-data.mjs'

const BASE = `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  status      text        NOT NULL
);

CREATE TABLE tenant_contact (
  tenant_id   text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  id          text        NOT NULL
);

ALTER TABLE tenant_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_contact FORCE ROW LEVEL SECURITY;
`

const SPLIT = `
CREATE SCHEMA tenant;
CREATE SCHEMA control;

CREATE TABLE control.tenant (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  residency   text        NOT NULL
);

ALTER TABLE tenant_contact SET SCHEMA tenant;
ALTER TABLE tenant ADD COLUMN residency text NOT NULL;
ALTER TABLE tenant DROP COLUMN name;
ALTER TABLE tenant SET SCHEMA tenant;
ALTER TABLE tenant.tenant_contact DROP CONSTRAINT tenant_contact_tenant_id_fkey;
ALTER TABLE tenant.tenant_contact ADD CONSTRAINT tenant_contact_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenant.tenant (id) ON DELETE CASCADE;
ALTER TABLE tenant.tenant_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_contact FORCE ROW LEVEL SECURITY;
`

const FIXTURE = { '0001_base.sql': BASE, '0002_split.sql': SPLIT }

const LATE_RLS = {
  '0001_a.sql': `
CREATE SCHEMA control;

CREATE TABLE control.signing_key (
  id          text        PRIMARY KEY,
  tenant_id   text        NOT NULL
);
`,
  '0002_b.sql': `
ALTER TABLE control.signing_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.signing_key FORCE ROW LEVEL SECURITY;
`,
}

const DOT_TRAP = {
  '0001_a.sql': `
CREATE SCHEMA control;

CREATE TABLE control.tenant (
  id          text        PRIMARY KEY
);

CREATE TABLE controlXtenant (
  id          text        PRIMARY KEY
);

ALTER TABLE controlXtenant ENABLE ROW LEVEL SECURITY;
`,
}

/* ------------------------------------------------------------------ *
 * EXPAND / CONTRACT — the vocabulary G88 needs and the scanner refuses.
 *
 * 🛑 WHY THIS IS THE SCANNER'S PROBLEM AND NOT THE MIGRATION AUTHOR'S.
 * `ALTER TABLE t ADD COLUMN c text NOT NULL` — one statement, no DEFAULT —
 * CANNOT APPLY to a table containing rows: PostgreSQL raises `column "c" of
 * relation "t" contains null values`. G88 rules expand/contract for v1 and
 * `docs/day-2-operations.md` §3.2 says it "must be adopted before the first
 * deployment or not at all", and the expand/contract form of that statement is
 * three statements — ADD NULLABLE, BACKFILL, SET NOT NULL. Two of the three are
 * vocabulary this scanner does not have, so the ONLY forms it accepts today are
 * the ones that cannot survive a populated table.
 *
 * ⚠️ AND `SET NOT NULL` MUST BE TAUGHT, NOT WHITELISTED. The page prints a
 * `null` column per table (`c4-template.html`, `c.notNull ? 'NOT NULL' :
 * 'nullable'`), so adding the form to a pass-list without applying it would
 * render a NOT NULL column as nullable — an under-report of a live constraint,
 * which is the direction `refuseUnrecognisedDdl` exists to refuse.
 * ------------------------------------------------------------------ */

/** The three-statement expand/contract of a NOT NULL column, on a populated table. */
const EXPAND_CONTRACT = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);
`,
  '0002_b.sql': `
ALTER TABLE tenant ADD COLUMN residency text;
UPDATE tenant SET residency = 'ap-southeast-1' WHERE residency IS NULL;
ALTER TABLE tenant ALTER COLUMN residency SET NOT NULL;
`,
}

/**
 * ⚠️ **THIS FIXTURE CHANGED SIDES ON 20 Sep 2026 AND THE OLD COMMENT IS KEPT AS
 * THE HISTORY IT IS.** It read *"The widening must not reach the other
 * direction"*, and the assertion beside it was a NEGATIVE CONTROL requiring the
 * scanner to REFUSE. `db/migrations/0161` (R-D, the owner's) needed the form,
 * `tools/planner/extract-c4-data.mjs` was TAUGHT it — `column.notNull = false`
 * is written, not merely tolerated — and **the tripwire fired exactly as
 * designed, in the gate, on the commit that changed the scanner.** The refusal
 * assertion is replaced by the positive one below rather than deleted, which is
 * what `0014`/`0017` did one directory over when the same thing happened to a
 * `usage_record` absence.
 */
const DROP_NOT_NULL = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);
`,
  '0002_b.sql': `ALTER TABLE tenant ALTER COLUMN status DROP NOT NULL;`,
}

/** `DROP NOT NULL` is DISCLOSING: it may only stand FIRST in an action list. */
const SMUGGLED_DROP_NOT_NULL = {
  '0001_a.sql': DROP_NOT_NULL['0001_a.sql'],
  '0002_b.sql': `ALTER TABLE tenant
  ADD COLUMN residency text,
  ALTER COLUMN status DROP NOT NULL;`,
}

/** An `ALTER COLUMN` naming a column the scanner never read cannot have run. */
const DROP_NOT_NULL_UNRESOLVABLE = {
  '0001_a.sql': DROP_NOT_NULL['0001_a.sql'],
  '0002_b.sql': `ALTER TABLE tenant ALTER COLUMN nobody_added_this DROP NOT NULL;`,
}

/** Nor to the other `ALTER COLUMN` sub-actions, which change depicted facts. */
const SET_DEFAULT = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);
`,
  '0002_b.sql': `ALTER TABLE tenant ALTER COLUMN status SET DEFAULT 'active';`,
}

/** Nor may a backfill smuggle a catalogue write, which is how RLS gets turned off. */
const CATALOGUE_UPDATE = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);
`,
  '0002_b.sql': `UPDATE pg_class SET relrowsecurity = false WHERE relname = 'tenant';`,
}

/** Nor may `SET NOT NULL` ride behind an addition, the #164 shape. */
const SMUGGLED_SET_NOT_NULL = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);
`,
  '0002_b.sql': `ALTER TABLE tenant ADD COLUMN x text SET NOT NULL;`,
}

/**
 * The online-constraint pattern stores its pending state in the rendered text.
 *
 * 🛑 THE WHITESPACE INSIDE THE LITERAL IS THE WHOLE FIXTURE. This read
 * `CHECK (id <> 'not valid')` until 16 Aug 2026, and a quote sat immediately
 * before `not` — so `\s+not` could not match inside the literal, and the strip's
 * `$` anchor was decoration. Dropping ONLY the anchor, `/\s+not\s+valid$/i` →
 * `/\s+not\s+valid/i` — the likeliest lazy repair — left all 96 tests in this
 * suite and `schema-scanner-integrity` GREEN. The assertion below advertises
 * *only the pending-state suffix is removed* and proved something weaker.
 * `'a not valid'` puts whitespace before `not`, so the unanchored strip eats the
 * CHECK data and leaves `NOT VALID` standing, and BOTH assertions go red.
 */
const ONLINE_CONSTRAINT = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id          text        PRIMARY KEY,
  status      text        NOT NULL
);

ALTER TABLE tenant ADD CONSTRAINT tenant_id_ck CHECK (id <> 'a not valid') NOT VALID;
`,
  '0002_b.sql': `ALTER TABLE tenant VALIDATE CONSTRAINT tenant_id_ck;`,
}

const CASE_DISTINCT_CONSTRAINTS = {
  '0001_a.sql': `
CREATE TABLE tenant (
  id text PRIMARY KEY
);

ALTER TABLE tenant ADD CONSTRAINT "Name" CHECK (id <> '') NOT VALID;
ALTER TABLE tenant ADD CONSTRAINT "name" CHECK (id <> '') NOT VALID;
ALTER TABLE tenant VALIDATE CONSTRAINT "name";
`,
}

const DISABLES = { '0002_x.sql': `ALTER TABLE tenant DISABLE ROW LEVEL SECURITY;` }
const NO_FORCE = { '0002_x.sql': `ALTER TABLE tenant NO FORCE ROW LEVEL SECURITY;` }
const DROPS_POLICY = { '0002_x.sql': `DROP POLICY tenant_rls ON tenant;` }
const DROPS_TABLE = { '0002_x.sql': `DROP TABLE tenant_contact;` }
const DROPS_SCHEMA = { '0002_x.sql': `DROP SCHEMA tenant;` }

describe('schema scanner — the plane-split DDL vocabulary', () => {
  it('scanned BOTH fixture files and produced tables — a scan of nothing is not a pass', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    assert.equal(parsed.parsedFrom.length, 2)
    assert.ok(parsed.tables.length >= 3, 'expected the two base tables plus control.tenant')
  })

  it('CREATE SCHEMA is rendered, not merely tolerated', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    assert.deepEqual([...parsed.schemas].sort(), ['control', 'public', 'tenant'])
  })

  it('SET SCHEMA moves the table into its new schema', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    const moved = parsed.tables.find((t) => t.name === 'tenant_contact' && t.schema === 'tenant')
    assert.ok(moved, 'tenant_contact must survive the move into schema tenant')
  })

  it('a schema-qualified ENABLE in a LATER migration file still reads as enabled', () => {
    const parsed = parseDbSchemaFrom(LATE_RLS)
    const k = parsed.tables.find((t) => t.schema === 'control' && t.name === 'signing_key')
    assert.ok(k, 'the table must be found under schema control')
    assert.equal(k.rlsEnabled, true, 'a schema-qualified ENABLE in a later file must read as enabled')
    assert.equal(k.rlsForced, true, 'and the same for FORCE')
  })

  it('an unescaped dot must NOT be matched as a wildcard — controlXtenant is not control.tenant', () => {
    const parsed = parseDbSchemaFrom(DOT_TRAP)
    const qualified = parsed.tables.find((t) => t.schema === 'control' && t.name === 'tenant')
    const decoy = parsed.tables.find((t) => t.schema === 'public' && t.name === 'controlXtenant')
    assert.ok(qualified && decoy, 'both tables must parse, or this control proves nothing')
    assert.equal(decoy.rlsEnabled, true, 'the decoy is the table the ALTER actually names')
    assert.equal(
      qualified.rlsEnabled,
      false,
      'control.tenant has no ENABLE of its own; a `.` left unescaped in the ' +
        'interpolated name matches `controlXtenant` and OVERSTATES isolation',
    )
  })

  it('ADD COLUMN and DROP COLUMN are both applied to the named table', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    const t = parsed.tables.find((x) => x.name === 'tenant' && x.schema === 'tenant')
    assert.ok(t)
    assert.deepEqual(t.columns.map((c) => c.name).sort(), ['id', 'residency', 'status'])
  })

  it('a qualified CREATE TABLE does not collide with the same name in another schema', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    const homes = parsed.tables.filter((t) => t.name === 'tenant').map((t) => t.schema).sort()
    assert.deepEqual(homes, ['control', 'tenant'])
  })

  it('DROP CONSTRAINT removes it and ADD CONSTRAINT records the new one', () => {
    const parsed = parseDbSchemaFrom(FIXTURE)
    const c = parsed.tables.find((x) => x.name === 'tenant_contact' && x.schema === 'tenant')
    assert.ok(c)
    assert.equal(
      c.constraints.filter((s) => /tenant_contact_tenant_id_fkey/i.test(s)).length,
      1,
      'the re-pointed FK must appear exactly once — not zero, and not both copies',
    )
    assert.match(c.constraints.join('\n'), /references\s+tenant\.tenant/i)
  })

  /* ---------------------------------------------------------------- *
   * EXPAND / CONTRACT. The first three are RED on creation; the four
   * after them are NEGATIVE CONTROLS and are green before the widening
   * as well as after — they are here to pin what the widening must not
   * reach, and they are labelled rather than counted as red.
   * ---------------------------------------------------------------- */

  it('a backfill UPDATE is read without refusing, and changes no depicted column', () => {
    const parsed = parseDbSchemaFrom(EXPAND_CONTRACT)
    const t = parsed.tables.find((x) => x.name === 'tenant')
    assert.ok(t, 'the table must survive an expand/contract migration')
    assert.deepEqual(
      t.columns.map((c) => c.name).sort(),
      ['id', 'residency', 'status'],
      'the UPDATE must add and remove nothing',
    )
  })

  it('ALTER COLUMN … SET NOT NULL is APPLIED, not merely tolerated', () => {
    const parsed = parseDbSchemaFrom(EXPAND_CONTRACT)
    const c = parsed.tables.find((x) => x.name === 'tenant').columns.find((x) => x.name === 'residency')
    assert.ok(c, 'residency must exist after ADD COLUMN')
    // The page prints `NOT NULL` or `nullable` from exactly this field. Passing
    // the statement through without applying it renders a live constraint as
    // absent — the under-report direction refuseUnrecognisedDdl exists to stop.
    assert.equal(c.notNull, true, 'SET NOT NULL must reach the rendered column')
  })

  it('the column is nullable BETWEEN the expand and the contract — order is applied, not assumed', () => {
    const partial = {
      '0001_a.sql': EXPAND_CONTRACT['0001_a.sql'],
      '0002_b.sql': `ALTER TABLE tenant ADD COLUMN residency text;\nUPDATE tenant SET residency = 'x';\n`,
    }
    const c = parseDbSchemaFrom(partial).tables
      .find((x) => x.name === 'tenant')
      .columns.find((x) => x.name === 'residency')
    assert.equal(c.notNull, false, 'without the third statement the column is still nullable')
  })

  /* ⚠️ THE THREE BELOW REPLACE ONE NEGATIVE CONTROL THAT READ
     `it('still REFUSES ALTER COLUMN … DROP NOT NULL', …)` UNTIL 20 Sep 2026.
     **It went RED in the gate on the commit that taught the scanner the form**
     — `db/migrations/0161`, R-D — which is a tripwire working rather than a
     test breaking. It is REPLACED by a positive assertion plus the two edges
     the widening must not reach, in the same commit, exactly as its own
     "a form is added when a migration needs it and is shown to be applied"
     rule demands. */

  it('ALTER COLUMN … DROP NOT NULL is APPLIED, not merely tolerated', () => {
    const c = parseDbSchemaFrom(DROP_NOT_NULL)
      .tables.find((x) => x.name === 'tenant')
      .columns.find((x) => x.name === 'status')
    assert.ok(c, 'status must exist')
    /* The page prints `NOT NULL` or `nullable` from exactly this field.
       Recognising the form WITHOUT applying it renders a constraint that is
       GONE as present — the OVER-report direction, and the worse of the two,
       because a reader trusts a constraint that no longer exists. */
    assert.equal(c.notNull, false, 'DROP NOT NULL must reach the rendered column')
  })

  it('DROP NOT NULL is DISCLOSING — refused in the TAIL of an action list', () => {
    assert.throws(() => parseDbSchemaFrom(SMUGGLED_DROP_NOT_NULL), /does not/i)
  })

  it('DROP NOT NULL on a column the scanner never read is REFUSED, not a no-op', () => {
    assert.throws(() => parseDbSchemaFrom(DROP_NOT_NULL_UNRESOLVABLE), /has not read/i)
  })

  // NEGATIVE CONTROL — green before the widening too.
  it('still REFUSES ALTER COLUMN … SET DEFAULT', () => {
    assert.throws(() => parseDbSchemaFrom(SET_DEFAULT), /does not/i)
  })

  // NEGATIVE CONTROL — green before the widening too. A catalogue UPDATE is the
  // one way a DML statement turns RLS off, so recognising UPDATE must not reach it.
  it('still REFUSES an UPDATE against a system catalogue', () => {
    assert.throws(() => parseDbSchemaFrom(CATALOGUE_UPDATE), /does not/i)
  })

  // NEGATIVE CONTROL — green before the widening too. The #164 juxtaposition shape.
  it('still REFUSES SET NOT NULL smuggled into an ADD COLUMN tail', () => {
    assert.throws(() => parseDbSchemaFrom(SMUGGLED_SET_NOT_NULL), /does not/i)
  })

  it('VALIDATE CONSTRAINT resolves the table and removes only terminal NOT VALID', () => {
    const constraint = parseDbSchemaFrom(ONLINE_CONSTRAINT).tables
      .find((x) => x.name === 'tenant').constraints.at(0)
    assert.match(constraint, /'a not valid'/i, 'CHECK data must not be rewritten')
    assert.doesNotMatch(constraint, /\snot\s+valid\s*$/i, 'only the pending-state suffix is removed')
  })

  it('CREATE EXTENSION pgcrypto is recognised but changes no depicted schema', () => {
    const before = parseDbSchemaFrom(EXPAND_CONTRACT)
    const after = parseDbSchemaFrom({
      ...EXPAND_CONTRACT,
      '0003_c.sql': 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;',
    })
    assert.deepEqual(after.tables, before.tables)
    assert.deepEqual(after.policies, before.policies)
    assert.deepEqual(after.schemas, before.schemas)
  })

  it('still REFUSES validation of an unresolvable constraint', () => {
    assert.throws(
      () => parseDbSchemaFrom({ ...ONLINE_CONSTRAINT, '0002_b.sql': 'ALTER TABLE tenant VALIDATE CONSTRAINT absent;' }),
      /unresolvable constraint/i,
    )
  })

  /**
   * ⚠️ THIS REPLACES A DELETED TEST AND THE DELETION IS THE POINT. Until
   * 16 Aug 2026 an `it('still REFUSES validation of a constraint that is
   * already valid')` stood here, asserting `/not valid/i` was thrown for this
   * exact input. It pinned behaviour a live PostgreSQL 14.18 refutes —
   * `VALIDATE CONSTRAINT` on an already-valid constraint is accepted, twice
   * over, `convalidated` unchanged. The assertion was deleted with the guard it
   * pinned rather than weakened, and this one asserts the opposite property:
   * re-validation is ADMITTED and moves nothing, because the constraint the
   * scanner read carries no `NOT VALID` marker and is already drawn as valid.
   */
  it('ADMITS validation of a constraint that is already valid, and moves nothing', () => {
    const alreadyValid = {
      ...ONLINE_CONSTRAINT,
      '0001_a.sql': ONLINE_CONSTRAINT['0001_a.sql'].replace(/ NOT VALID;/, ';'),
      '0002_b.sql': `
ALTER TABLE tenant VALIDATE CONSTRAINT tenant_id_ck;
ALTER TABLE tenant VALIDATE CONSTRAINT tenant_id_ck;
`,
    }
    const withValidate = parseDbSchemaFrom(alreadyValid)
    const withoutValidate = parseDbSchemaFrom({ '0001_a.sql': alreadyValid['0001_a.sql'] })
    assert.deepEqual(withValidate.tables, withoutValidate.tables)
    const constraint = withValidate.tables.find((x) => x.name === 'tenant').constraints.at(0)
    assert.match(constraint, /'a not valid'/i, 'CHECK data must not be rewritten')
    assert.doesNotMatch(constraint, /\snot\s+valid\s*$/i, 'nothing was pending, so nothing is stripped')
  })

  it('VALIDATE CONSTRAINT binds a quoted identifier exactly', () => {
    const constraints = parseDbSchemaFrom(CASE_DISTINCT_CONSTRAINTS).tables.at(0).constraints
    assert.match(constraints.find((x) => /"Name"/.test(x)), /NOT VALID$/i)
    assert.doesNotMatch(constraints.find((x) => /"name"/.test(x)), /NOT VALID$/i)
  })

  it('still REFUSES VALIDATE CONSTRAINT smuggled into an ADD CONSTRAINT tail', () => {
    assert.throws(
      () => parseDbSchemaFrom({
        '0001_a.sql': `
CREATE TABLE tenant (
  id text PRIMARY KEY
);
ALTER TABLE tenant ADD CONSTRAINT tenant_id_ck CHECK (id <> '') NOT VALID VALIDATE CONSTRAINT tenant_id_ck;
`,
      }),
      /does not/i,
    )
  })

  /**
   * ⚠️ `postgis` IS NAMED HERE BECAUSE THE ALLOWLIST'S CONTENT WAS UNPINNED.
   * With `hstore` as the only refused extension, widening
   * `RENDER_NEUTRAL_EXTENSIONS` from `new Set(['pgcrypto'])` to
   * `new Set(['pgcrypto', 'postgis'])` left all 96 tests GREEN — the suite
   * pinned that SOME extension is refused, not WHICH. `postgis` is the widening
   * a future reader would actually reach for, and it is the one the corpus-level
   * gate already refuses, so it is the one the unit suite must refuse too.
   */
  it('still REFUSES non-pgcrypto extensions and pgcrypto CASCADE', () => {
    assert.throws(() => parseDbSchemaFrom({ '0001_a.sql': 'CREATE EXTENSION hstore;' }), /does not/i)
    assert.throws(() => parseDbSchemaFrom({ '0001_a.sql': 'CREATE EXTENSION postgis;' }), /does not/i)
    assert.throws(() => parseDbSchemaFrom({ '0001_a.sql': 'CREATE EXTENSION pgcrypto CASCADE;' }), /does not/i)
    assert.throws(() => parseDbSchemaFrom({ '0001_a.sql': 'CREATE EXTENSION "PGCRYPTO";' }), /does not/i)
  })

  it('still REFUSES a statement that disables RLS', () => {
    assert.throws(() => parseDbSchemaFrom(DISABLES), /does not/i)
  })

  it('still REFUSES NO FORCE', () => {
    assert.throws(() => parseDbSchemaFrom(NO_FORCE), /does not/i)
  })

  /**
   * ⚠️ THIS TEST USED TO READ `still REFUSES a dropped policy` AND IS REPLACED
   * RATHER THAN DELETED, BECAUSE THE PROPERTY IT PINNED IS THE RIGHT ONE AND
   * THE BEHAVIOUR UNDER IT GOT STRONGER.
   *
   * The scanner now UNDERSTANDS `DROP POLICY` — `0027` has to drop and
   * recreate one, because `ALTER POLICY` cannot change a policy's command
   * (`FOR ALL` → `FOR UPDATE` is not alterable in PostgreSQL). Teaching it is
   * the path the refusal message itself offers: *"Either teach
   * extract-c4-data.mjs the statement form, or add it to RECOGNISED_DDL if it
   * genuinely does not change what the page depicts."* A dropped policy
   * changes it more than almost anything, so it was taught, not allowlisted.
   *
   * 🛑 THE PROPERTY THE OLD TEST GUARDED SURVIVES IN §a, AND IT IS THE HALF
   * THAT MATTERS: **a drop the scanner cannot attribute still refuses.** If it
   * silently did nothing, the page would render a policy set that never
   * matched the database, and `check-c4-freshness.mjs` would stay GREEN
   * because it re-derives the same wrong answer from the same unread
   * statement.
   *
   * §b is the new half and is why the change is an improvement rather than a
   * relaxation: an attributable drop is READ, and the policy leaves the model.
   */
  it('a DROP POLICY the scanner cannot attribute still REFUSES', () => {
    assert.throws(() => parseDbSchemaFrom(DROPS_POLICY), /no earlier migration/i)
  })

  it('a DROP POLICY it CAN attribute is understood, and the policy leaves the model', () => {
    const CREATED = `
CREATE SCHEMA control;

CREATE TABLE control.signing_key (
  id          text        PRIMARY KEY,
  tenant_id   text        NOT NULL
);

ALTER TABLE control.signing_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.signing_key FORCE ROW LEVEL SECURITY;

CREATE POLICY signing_key_rls ON control.signing_key
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''));
`
    const before = parseDbSchemaFrom({ '0001_a.sql': CREATED })
    assert.equal(
      before.policies.filter((p) => p.name === 'signing_key_rls').length,
      1,
      'the fixture did not create the policy, so the drop below would prove nothing',
    )

    const after = parseDbSchemaFrom({
      '0001_a.sql': CREATED,
      '0002_b.sql': 'DROP POLICY signing_key_rls ON control.signing_key;\n',
    })
    assert.equal(
      after.policies.filter((p) => p.name === 'signing_key_rls').length,
      0,
      'the scanner accepted the DROP and left the policy in the model, so the C4 page ' +
        'would render a predicate the database no longer enforces — and check-c4-freshness ' +
        'would stay GREEN, re-deriving the same wrong answer.',
    )
  })

  it('still REFUSES a dropped table', () => {
    assert.throws(() => parseDbSchemaFrom(DROPS_TABLE), /does not/i)
  })

  it('still REFUSES a dropped schema', () => {
    assert.throws(() => parseDbSchemaFrom(DROPS_SCHEMA), /does not/i)
  })
})

// G4453 — control `0052` (S5) retires two roles. The page must stop drawing
// their grants, and the one `ALTER ROLE` form it recognises must be the
// narrowing one ONLY.
describe('a whole-role REVOKE removes that role\'s rendered grants (G4453)', () => {
  const GRANTS = `
CREATE TABLE roster (
  id text PRIMARY KEY
);
GRANT USAGE ON SCHEMA public TO retired_reader;
GRANT SELECT ON roster TO retired_reader;
GRANT SELECT ON roster TO kept_app;
`
  it('anti-vacuity: before the revoke the retired role\'s grants are drawn', () => {
    const before = parseDbSchemaFrom({ '0001_a.sql': GRANTS })
    assert.equal(before.grants.filter((g) => g.to === 'retired_reader').length, 2)
  })

  it('REVOKE ALL … ON ALL TABLES and REVOKE USAGE ON SCHEMA remove exactly that role\'s grants', () => {
    const after = parseDbSchemaFrom({
      '0001_a.sql': GRANTS,
      '0002_b.sql':
        'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM retired_reader;\n' +
        'REVOKE USAGE ON SCHEMA public FROM retired_reader;\n' +
        'ALTER ROLE retired_reader NOLOGIN PASSWORD NULL;\n',
    })
    assert.deepEqual(after.grants.filter((g) => g.to === 'retired_reader'), [])
    assert.equal(after.grants.filter((g) => g.to === 'kept_app').length, 1, 'another role\'s grant must survive')
  })

  it('an ALTER ROLE that WIDENS a role is refused, not recognised', () => {
    for (const widen of ['ALTER ROLE r LOGIN;', 'ALTER ROLE r BYPASSRLS;', "ALTER ROLE r NOLOGIN PASSWORD 'x';", 'ALTER ROLE r NOLOGIN SUPERUSER;']) {
      assert.throws(() => parseDbSchemaFrom({ '0001_a.sql': GRANTS, '0002_b.sql': `${widen}\n` }), /does not understand/i, widen)
    }
  })
})
