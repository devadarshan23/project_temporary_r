/**
 * THE SESSION ROW — #222 [A-2], under G180, G220, G223 and G210.
 *
 * 🛑 WHY SOME TESTS PASS AT BASE, AND WHY THAT IS THE POINT. #222 names the
 * trap in its own body: *"At the red commit `Session` does not exist, so every
 * assertion fails identically — red against a typo."* A file whose only import
 * is the symbol under construction does not LINK at base; Node reports one
 * file-level failure and every case fails for the same non-reason, which proves
 * nothing about the row.
 *
 * So this file is split. The BASE FACTS below assert things that are true
 * before this slice and must stay true after it — `Timestamp` is a bare string
 * alias, `IdentityConnectionId` is branded, `TenantScoped` requires a non-null
 * `tenantId`, and `redeemAuthorization()` still compares a stamped `orgClass`
 * against a freshly derived one. They pass at base. Everything under THE ROW
 * fails at base, each naming the field it could not reach. The measured split
 * is in the commit message that lands the red.
 *
 * The row's values are reached through `await import()` inside the tests that
 * need them, for the reason `tests/model/finding-standing.test.ts` records: a
 * top-level value import of a symbol that does not exist yet turns a legible
 * partial red into one synthetic link error.
 *
 * ⚠️ THE KEY COUNT IS ELEVEN AND #222's BODY SAYS TEN. Both issue bodies
 * predate **G220** (22 Aug 2026), which rules that **`lastUsedAt` STAYS ON THE
 * SESSION ROW** — *"without it there is nothing to compare the clock against,
 * and `maxIdleSeconds` becomes a number the system holds and cannot act on."*
 * `docs/build/stateless-green-session.md` settled the row at NINE and listed
 * *"No `lastUsedAt` (§6.4)"* among its deliberate absences; **G180** added
 * `issuedHost` (ten) and **G220** reversed §6.4 (eleven). `docs/HANDOFF.md` §3
 * outranks `docs/build/`, and G220 outranks G180 by date on the field they
 * disagree about. Do not "correct" eleven back to ten.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

const DOMAIN_TEXT = readFileSync(join(MODEL_DIR, 'domain.ts'), 'utf8')
const KERNEL_TEXT = readFileSync(join(MODEL_DIR, 'kernel.ts'), 'utf8')
const IDENTITY_TEXT = readFileSync(join(MODEL_DIR, 'identity.ts'), 'utf8')
const ACCESS_TEXT = readFileSync(join(MODEL_DIR, 'access.ts'), 'utf8')

/** Every `model/*.ts`, as `[relative path, text]`. */
function modelSources(): ReadonlyArray<readonly [string, string]> {
  return readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .map((f) => [`model/${f}`, readFileSync(join(MODEL_DIR, f), 'utf8')] as const)
}

/**
 * The same text with every comment removed.
 *
 * 🛑 THIS EXISTS BECAUSE THE SLICE THAT ADDED IT TRIPPED ON IT. Three sweeps in
 * this file and one in `tests/model/sign-in-attempt.test.ts` went red against
 * the DOCBLOCKS THIS SLICE WROTE — a paragraph explaining why there is no
 * tenant selector contains the words `selectTenantForSession`, and a paragraph
 * explaining why there is no lockout contains the word `lockout`. That is
 * exactly the false-positive class `CLAUDE.md` records: the `@dropped-for-v1`
 * awk "arms on any line CONTAINING the marker, including prose ABOUT another
 * declaration's drop", which is the same defect that once rendered seven live
 * exports as dropped on the C4 page.
 *
 * A sweep for an ABSENCE has to read code, or the argument for the absence
 * becomes evidence against it — and the more carefully the absence is argued,
 * the louder the false positive. Anything asserting "this identifier appears
 * nowhere" goes through here; anything asserting "this ruling is cited on the
 * declaration" deliberately does NOT.
 */
function codeOnly(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const two = text.slice(i, i + 2)
    if (two === '//') {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end
      continue
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    const ch = text[i] ?? ''
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch
      i += 1
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') i += 1
        out += text[i] ?? ''
        i += 1
      }
      out += ch
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/**
 * The field names declared directly inside `export interface <name> {` … `}`.
 *
 * Text, not types, deliberately: this file has to be able to say "the row is
 * missing" at base, and a type-level reader cannot run against a type that does
 * not exist. The TYPE-level closure is `_SessionCarriesExactlyTheseKeys` in
 * `model/identity.ts`; this is the runtime witness beside it, and the two fail
 * for different reasons — a field added to the interface and not to the union
 * reddens the assertion, a field added to both and not to the fixture reddens
 * the fixture test below.
 */
/**
 * The source text of one declaration, from `export …name` to its closing brace
 * column — copied verbatim from `tests/model/session-resolution.test.ts`, which
 * is the file it was written in. Two copies rather than a shared helper module
 * is deliberate for now: these suites are read one at a time, and a reader of
 * either should not have to open a third file to know what a sweep sees.
 */
function declarationText(text: string, opening: string): string {
  const at = text.indexOf(opening)
  assert.notEqual(at, -1, `declaration not found: ${opening}`)
  const end = text.indexOf('\n}', at)
  assert.notEqual(end, -1, `unterminated declaration: ${opening}`)
  return text.slice(at, end + 2)
}

function interfaceFieldNames(text: string, name: string): string[] {
  const open = text.indexOf(`export interface ${name} {`)
  if (open === -1) return []
  let depth = 0
  let i = text.indexOf('{', open)
  const start = i
  for (; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  const body = text.slice(start + 1, i)
  const names: string[] = []
  let nesting = 0
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (nesting === 0) {
      const m = /^(?:readonly )?([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line)
      if (m?.[1] !== undefined) names.push(m[1])
    }
    nesting += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    if (nesting < 0) nesting = 0
  }
  return names
}

/* ==================================================================== *
 * BASE FACTS — true before this slice, and the red below is legible
 * only because these pass.
 * ==================================================================== */

test('BASE — `Timestamp` is a bare `string` alias, which is why no contentless assertion may be pointed at a timestamped row', () => {
  assert.match(
    KERNEL_TEXT,
    /^export type Timestamp = string$/m,
    'THE PREMISE MOVED. `AssertNoPlainText` and `AssertNoTextDeep` both map a bare ' +
      '`string` property to `never`, so pointing either at `Session` — which carries five ' +
      'timestamps — FAILS rather than passes. If `Timestamp` ever becomes a branded or ' +
      'structured type, the argument recorded on the `Session` declaration for why it ' +
      'carries no containment proof stops holding and must be rewritten, not deleted.',
  )
})

test('BASE — `IdentityConnectionId` is branded, so the door cannot be named by a bare string', () => {
  assert.match(KERNEL_TEXT, /^export type IdentityConnectionId = Id<'IdentityConnection'>$/m)
})

test('BASE — `TenantScoped` requires a NON-NULL `tenantId`, which is why the session row is not one', () => {
  const fields = interfaceFieldNames(KERNEL_TEXT, 'TenantScoped')
  assert.deepEqual(fields, ['tenantId'])
  assert.match(
    KERNEL_TEXT,
    /export interface TenantScoped \{\n\s*tenantId: TenantId\n\}/,
    'IF `TenantScoped.tenantId` EVER BECOMES NULLABLE the whole argument for `Session` ' +
      'not extending it collapses, and `db/migrations/0001_tenancy_and_rls.sql`\'s ' +
      'deny-on-NULL predicate (G100) would make every unselected session invisible to the ' +
      'connection that just wrote it.',
  )
})

test('BASE — `redeemAuthorization()` still compares a STAMPED `orgClass` against a freshly derived one', () => {
  // This is the control a stored `Session.orgClass` would disarm: the
  // comparison has meaning only because one side is a stamp and the other is
  // derived per request. Store it on the session and it passes forever.
  assert.ok(
    /orgClass !== /.test(ACCESS_TEXT),
    'THE COMPARISON IS GONE. `redeemAuthorization()`\'s `grant.orgClass !== ' +
      'principal.orgClass` is the reason `Session` carries no `orgClass`. If the check ' +
      'has moved, the argument on the declaration has to move with it.',
  )
})

/* ==================================================================== *
 * THE ROW — every test below fails at base
 * ==================================================================== */

test('exactly one module declares `export interface Session`, and it is `model/domain.ts`', () => {
  const declaring = modelSources()
    .filter(([, text]) => /^export interface Session \{/m.test(text))
    .map(([path]) => path)
  assert.deepEqual(
    declaring,
    ['model/domain.ts'],
    'MG1: "There is no session type at all. All four entry routes establish, hold or end ' +
      'one; nothing in eighteen modules declares one." It lands in `model/domain.ts` and ' +
      'NOT in `model/session.ts`: that module declares ZERO imports and G220\'s row says ' +
      'so is the enforcement — the grant ceiling in `access.ts` is structurally ' +
      'unreachable from it. A `Session` there would need five kernel imports and would end ' +
      'that property.',
  )
})

test('the session key set is exactly these ELEVEN, in declaration order', () => {
  assert.deepEqual(interfaceFieldNames(DOMAIN_TEXT, 'Session'), [
    'id',
    'handleDigest',
    'userId',
    'connectionId',
    'tenantId',
    'issuedHost',
    'authenticatedAt',
    'secondFactorAt',
    'lastUsedAt',
    'expiresAt',
    'revokedAt',
  ])
})

test('a twelfth key of any type is a compile error, and the type-level closure that makes it one is declared', () => {
  // The runtime list above catches an added field; it does NOT catch a field
  // added to the interface AND to the list by the same hand. The bidirectional
  // constraint does, because the enumeration it compares against lives in a
  // different module written for a different purpose.
  assert.match(
    IDENTITY_TEXT,
    /export type _SessionCarriesExactlyTheseKeys = AssertKeySetIsExactly</,
    'The bidirectional key-set assertion is gone. A single `extends` is NOT a ' +
      'substitute — it passes a widening in one direction, which is the exact case a ' +
      'closed key set exists to refuse.',
  )
})

test('`Session` is NOT `TenantScoped`, and the assertion that proves it is declared', () => {
  assert.doesNotMatch(
    DOMAIN_TEXT,
    /export interface Session extends TenantScoped/,
    'THE ROW WOULD BE INVISIBLE TO THE CONNECTION THAT JUST WROTE IT. `tenantId` is null ' +
      'between authentication and selection, and G100 rules the RLS predicate DENIES on ' +
      'NULL — so a `TenantScoped` session table denies unconditionally for exactly the ' +
      'rows that have not selected a tenant yet.',
  )
  assert.match(IDENTITY_TEXT, /export type _SessionIsNotTenantScoped = /)
})

test('`tenantId` is REQUIRED-AND-NULLABLE, never optional', () => {
  assert.match(
    DOMAIN_TEXT,
    /^\s*tenantId: TenantId \| null$/m,
    'OPTIONAL WOULD LET A WIRE PAYLOAD OMIT THE KEY SILENTLY while `tsc` stayed green. ' +
      'The distinction is the same one `model/learning.ts` argues for the one field whose ' +
      'absence is a bypass.',
  )
})

test('G180 — the row stores its issuing host, and the ruling is cited on the field', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'Session')
  assert.ok(
    keys.includes('issuedHost'),
    'A SESSION TABLE MINTED WITHOUT `issuedHost` NEEDS A MIGRATION TO ADD IT, under G88\'s ' +
      'forward-only rule, on the ONE field G180 calls permanent. G180: "the session record ' +
      'stores the host it was issued on, and any request whose Host differs is refused and ' +
      'the session revoked."',
  )
  const block = /issuedHost: string/.exec(DOMAIN_TEXT)
  assert.ok(block !== null, '`issuedHost` is not a `string`')
  const docblock = DOMAIN_TEXT.slice(Math.max(0, block.index - 2600), block.index)
  assert.ok(
    docblock.includes('G180'),
    'G180 IS NOT CITED ON `issuedHost`. The field looks like telemetry and is a control: ' +
      'without the citation the next reader deletes it as an unused audit column.',
  )
})

test('G220 — `lastUsedAt` is on the row, because without it `maxIdleSeconds` is a number the system cannot act on', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'Session')
  assert.ok(
    keys.includes('lastUsedAt'),
    'G220 REVERSED `docs/build/stateless-green-session.md` §6.4, which listed "No ' +
      '`lastUsedAt`" among the row\'s deliberate absences. §3 outranks `docs/build/`. ' +
      '`model/session.ts` declares `maxIdleSeconds` and there is nothing else on any row ' +
      'to compare a clock against.',
  )
})

test('G223 — `secondFactorAt` is declared, dropped for v1, and has NO producer anywhere', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'Session')
  assert.ok(
    keys.includes('secondFactorAt'),
    'DROPPED IS NOT DELETED. G223 keeps the declaration and marks it, under the standing ' +
      'v1 discipline.',
  )
  const at = DOMAIN_TEXT.indexOf('secondFactorAt: Timestamp | null')
  assert.notEqual(at, -1, '`secondFactorAt` is not `Timestamp | null`')
  const docblock = DOMAIN_TEXT.slice(Math.max(0, at - 2000), at)
  assert.ok(
    /@dropped-for-v1 22 Aug 2026/.test(docblock) && docblock.includes('G223'),
    'G223 requires the exact marker: "@dropped-for-v1 22 Aug 2026 — federation owns the ' +
      'second factor. Declared, not built."',
  )
  // The defect #234 filed and G223 avoids: a field written by nothing and read
  // as "no second factor was performed" forever — indistinguishable from "this
  // system does not do second factors", which is the true statement.
  //
  // A PRODUCER IS AN ASSIGNMENT OF A VALUE, and `null` is not one: null is the
  // absence this field is permanently in, so the fixtures that state it are
  // holding the line rather than crossing it. The declaration itself is
  // excluded for the same reason.
  const producers = modelSources().flatMap(([path, text]) =>
    [...codeOnly(text).matchAll(/secondFactorAt\s*[:=]\s*([^,\n]*)/g)]
      .map((m) => `${path}: secondFactorAt = ${(m[1] ?? '').trim()}`)
      .filter((s) => !/= (null|Timestamp \| null)$/.test(s)),
  )
  assert.deepEqual(
    producers,
    [],
    'G223: "Do NOT give it a producer." A second factor in v1 belongs to the directory ' +
      'that authenticates the person; shipping ours beside it is a second authenticator ' +
      'competing with the customer\'s policy.',
  )
})

/**
 * 🛑 THIS TEST WAS WRONG, AND IT WENT RED ON THE COMMIT THAT PROVED IT WRONG.
 * THE OLD FORM IS QUOTED RATHER THAN DELETED, because it is the assertion a
 * reader would have trusted and because the mistake is the one this file's own
 * `codeOnly()` note is about, arriving one layer up.
 *
 *     const selectors = modelSources().filter(([, text]) =>
 *       /selectTenantForSession|listTenantsForSession|chooseTenant/.test(codeOnly(text)),
 *     )
 *     assert.deepEqual(selectors.map(([p]) => p), [], …)
 *
 * **It swept for the name `selectTenantForSession` as if the name were the
 * defect.** G210's own sentence, quoted in its own comment two lines above the
 * regex, is *"`selectTenantForSession()` is the CHECK, never the CHOOSER"* —
 * so the ruling REQUIRES that function to exist and the test forbade it. §5.1
 * exactly: **a rule keyed on a convenient landmark (a function's name)
 * instead of the property it protects (that nothing offers a CHOICE).** It
 * would have gone red on the correct implementation and green on a `listTenants`
 * that happened to be spelled differently.
 *
 * Witnessed RED against `model/access.ts` on the commit that landed
 * `selectTenantForSession()` under G199, with `[ 'model/access.ts' ]` against
 * `[]` — which is how the defect surfaced rather than being noticed by reading.
 *
 * WHAT REPLACES IT IS TWO ASSERTIONS, BOTH KEYED ON THE PROPERTY:
 *   1. no PLURAL selector exists, by name — the shapes G210 actually dropped;
 *   2. the check that does exist takes ONE tenant and returns ONE tenant, and
 *      its input declaration carries no plural tenant field. A menu cannot be
 *      returned from a function with nothing plural to return.
 */

test('G210 — nothing in `model/` mints a tenant CHOOSER', () => {
  // The shapes G210 dropped are the ones that OFFER, not the one that CHECKS.
  // `GET /session/tenants` and `POST /session/tenant` are dropped "not deferred,
  // because a deferred selection operation is a selector with a later date on it."
  const choosers = modelSources().filter(([, text]) =>
    /listTenantsForSession|tenantsForSession|chooseTenant|availableTenants|selectableTenants/.test(
      codeOnly(text),
    ),
  )
  assert.deepEqual(
    choosers.map(([p]) => p),
    [],
    'A login surface with a tenant selector defeats invariant 1 by RELOCATION — the ' +
      'tenant stops arriving in a request body and starts arriving in an unvalidated ' +
      'dropdown. G179 rules one host per tenant "precisely so that there is no ' +
      'selector to defeat."',
  )
})

test('G210 — the tenant check is SINGULAR on both sides, so there is no menu to return', () => {
  const code = codeOnly(ACCESS_TEXT)

  assert.match(
    code,
    /export function selectTenantForSession\(/,
    'G199 ships the customer arm NOW and #157 calls it "D1\'s gate. Nothing else on ' +
      'the session surface may precede it." Its absence is the finding, not its ' +
      'presence — the previous form of this test asserted the opposite and was wrong.',
  )

  const decl = declarationText(code, 'export interface TenantSelectionInput {')
  for (const plural of [
    'tenantIds',
    'candidateTenantIds',
    'tenants',
    'candidates',
    'availableTenants',
  ]) {
    assert.ok(
      !decl.includes(plural),
      `\`TenantSelectionInput.${plural}\` exists. A PLURAL tenant parameter is a menu, ` +
        'and a menu is the selector G210 dropped. The tenant arrives already decided, ' +
        'from the host under G179; this function answers yes or no about that one.',
    )
  }

  assert.match(
    decl,
    /hostBoundTenantId: TenantId/,
    'The one tenant this check is about must be SINGULAR and must be named for where ' +
      'it came from. `checkHostBinding()` in `model/serving-host.ts` is the only ' +
      'producer G179 permits.',
  )

  const fn = declarationText(code, 'export function selectTenantForSession(')
  assert.ok(
    !/\.map\(|\.filter\(|readonly TenantId\[\]/.test(fn),
    'The membership array is a HAYSTACK to search, not a menu to map. A ' +
      '`memberships → tenantIds` projection anywhere in this body is the chooser ' +
      `arriving by helpfulness.\n\n${fn}`,
  )
})

test('no `orgClass` and no role, capability or grant id is stored on the session', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'Session')
  for (const forbidden of [
    'orgClass',
    'roleId',
    'roleIds',
    'capabilities',
    'scope',
    'tenantAccessGrantId',
    'email',
    'displayName',
    'ipAddress',
    'userAgent',
    'sessionToken',
    'csrfToken',
  ]) {
    assert.ok(
      !keys.includes(forbidden),
      `\`${forbidden}\` is on the session row. Each of these is a STAMP of something ` +
        'derived per request, and a stamp that outlives the fact it copied is a second ' +
        'door. `orgClass` in particular disarms `redeemAuthorization()`\'s comparison — ' +
        'store it and the check passes forever.',
    )
  }
})

test('no CONTENTLESS assertion is pointed at `Session`, and the declaration says why', () => {
  const pointed = modelSources().filter(([, text]) =>
    /Assert(NoPlainText|NoTextDeep)<\s*Session\s*>/.test(text),
  )
  assert.deepEqual(
    pointed.map(([p]) => p),
    [],
    '`Timestamp = string`, so EVERY timestamped field maps to `never` and the assertion ' +
      'FAILS rather than passing. `Session` is the first timestamped type either guard has ' +
      'met. The `@ts-expect-error` witnesses in `tests/model/session-containment.test.ts` ' +
      'prove that failure rather than leaving the absence to be read as an oversight.',
  )
  const at = DOMAIN_TEXT.indexOf('export interface Session {')
  assert.notEqual(at, -1)
  const docblock = DOMAIN_TEXT.slice(Math.max(0, at - 6000), at)
  assert.ok(
    docblock.includes('AssertNoTextDeep') && docblock.includes('Timestamp'),
    'THE ABSENCE IS NOT ARGUED ON THE DECLARATION, so the next reader adds one and ' +
      'watches the build go red for a reason nobody wrote down.',
  )
})

test('`model/kernel.ts` declares `SessionId`, and the brand argument names the exported interface', () => {
  assert.match(KERNEL_TEXT, /^export type SessionId = Id<'Session'>$/m)
})

test('the fixture constructs a real session, because `tsc` stays green whatever is wrong here', async () => {
  // §5.10: a total `Record` — and a closed key set — only bites where something
  // CONSTRUCTS one, and in a types-only model nothing does. The fixture is the
  // only verification that the eleven keys can actually be populated.
  const { acmeAuthenticatedSession, acmeScopedSession, acmeRevokedSession } = await import(
    '../../model/examples.ts'
  )
  for (const [name, session] of [
    ['acmeAuthenticatedSession', acmeAuthenticatedSession],
    ['acmeScopedSession', acmeScopedSession],
    ['acmeRevokedSession', acmeRevokedSession],
  ] as const) {
    assert.deepEqual(
      Object.keys(session).sort(),
      [
        'authenticatedAt',
        'connectionId',
        'expiresAt',
        'handleDigest',
        'id',
        'issuedHost',
        'lastUsedAt',
        'revokedAt',
        'secondFactorAt',
        'tenantId',
        'userId',
      ],
      `${name} does not carry the eleven keys`,
    )
    assert.equal(
      session.secondFactorAt,
      null,
      `${name} gives \`secondFactorAt\` a value. G223 forbids a producer — a fixture that ` +
        'populates it is the first one.',
    )
  }
})

test('the unselected session carries a NULL tenant, and it is the state the row exists to represent', async () => {
  const { acmeAuthenticatedSession, acmeScopedSession } = await import('../../model/examples.ts')
  assert.equal(
    acmeAuthenticatedSession.tenantId,
    null,
    'A session with a null tenant can reach nothing tenant-scoped: no ' +
      "`set_config('app.tenant_id', …)` is ever issued, so RLS denies on NULL and the " +
      'failure is an EMPTY RESULT SET even if a handler forgets to check.',
  )
  assert.notEqual(acmeScopedSession.tenantId, null)
})

test('no session fixture stores a handle in the clear — digests only', async () => {
  const { acmeAuthenticatedSession, acmeScopedSession, acmeRevokedSession } = await import(
    '../../model/examples.ts'
  )
  for (const session of [acmeAuthenticatedSession, acmeScopedSession, acmeRevokedSession]) {
    assert.match(
      session.handleDigest,
      /^[0-9a-f]{64}$/,
      'A SESSION HANDLE IS A CREDENTIAL IN TRANSIT — possession lets you make the next ' +
        'call. A database dump containing handles would be a session-hijack kit. It ' +
        'contains digests, and the fixture has to look like one.',
    )
  }
})
