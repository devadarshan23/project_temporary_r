/**
 * G386's CHANNEL, ASSERTED BYTE BY BYTE — AND THE FENCE, ASSERTED AS AN
 * ABSENCE IN THE FILESYSTEM.
 *
 * ┌─ WHY THIS SUITE IS SEPARATE FROM `tests/e2e/browser-login.test.ts` ────────┐
 * │ That suite is the stronger one and it cannot reach either half of this.    │
 * │                                                                            │
 * │   · It SEEDS the cookie into Chromium's jar, so it witnesses that a cookie │
 * │     with these attributes is unreadable by page script and is sent to the  │
 * │     plane. It never sees a `Set-Cookie` this repository emitted, because   │
 * │     nothing in this repository mints a session.                            │
 * │   · It runs one plane, in one configuration. The structural half of        │
 * │     G386 — *"a plane started without the flag never LOADS the file"* — is  │
 * │     a property of the SOURCE TREE, and no running process can be           │
 * │     interrogated for a module it did not import.                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 NO DATABASE, NO BROWSER, NO PORT. Every assertion here is a pure function
 * of a string or of a file on disk, which is why it carries no reachability
 * guard and is never skipped. A suite that can only be run on a well-equipped
 * machine is a suite that stops being evidence on the machine that matters.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  SESSION_COOKIE,
  mintedSessionCookie,
  sessionCookieFrom,
  withdrawnSessionCookie,
} from '../../server/data-plane/session-cookie.ts'
import { SESSION_COOKIE as HARNESS_SPELLING, sessionCookie } from './harness.ts'
import { REPO_ROOT } from './harness.ts'

/**
 * `sessionCookieFrom()` takes a `FastifyRequest` and reads exactly one thing
 * off it. A whole Fastify instance to hand it one header would make this suite
 * need a port; the cast is a cast of SHAPE, and the shape is one property.
 */
function withCookie(header: string | undefined): Parameters<typeof sessionCookieFrom>[0] {
  return { headers: header === undefined ? {} : { cookie: header } } as unknown as Parameters<
    typeof sessionCookieFrom
  >[0]
}

const HANDLE = 'e2e_channel_9b31067ce4a8d29f1f4c8b02d7e64a95'

describe('§1 · the Set-Cookie this repository would emit', () => {
  it('1a · carries the name, the handle, and G386`s three attributes VERBATIM', () => {
    const set = mintedSessionCookie(HANDLE)

    assert.ok(
      set.startsWith(`${SESSION_COOKIE}=${HANDLE};`),
      `the value is not the handle, or the name moved. Saw: ${set}`,
    )

    /* Each attribute by NAME, with what it buys, so a deletion reports the
       property rather than a string diff. */
    assert.match(
      set,
      /(^|;\s*)HttpOnly(\s*;|$)/,
      'NO `HttpOnly`. G386: *"Page script cannot read it, so the exfiltration class ' +
        "`frontend/src/api/plane.ts`'s origin allowlist exists to guard STOPS BEING " +
        'POSSIBLE rather than being blocked."* Without it a crafted `?plane=` link has ' +
        `something to steal again. Saw: ${set}`,
    )
    assert.match(
      set,
      /(^|;\s*)Secure(\s*;|$)/,
      'NO `Secure`. The credential would travel over plaintext on any host that ever ' +
        'answers `http://`, AND the `__Host-` prefix below would be unsatisfiable, so the ' +
        `browser would silently refuse to store the cookie at all. Saw: ${set}`,
    )
    assert.match(
      set,
      /(^|;\s*)SameSite=Lax(\s*;|$)/,
      'NO `SameSite=Lax`. A cookie with no `SameSite` attribute is subject to the ' +
        '"Lax+POST" intervention — a cross-site POST carries it for two minutes after it ' +
        'is set — which is exactly the CSRF window the attribute is written out to close. ' +
        `Saw: ${set}`,
    )
  })

  it('1b · satisfies the `__Host-` prefix — `Path=/`, `Secure`, and NO `Domain` AT ALL', () => {
    for (const set of [mintedSessionCookie(HANDLE), withdrawnSessionCookie()]) {
      assert.ok(
        SESSION_COOKIE.startsWith('__Host-'),
        'the cookie lost its `__Host-` prefix. That prefix is what makes the cookie ' +
          'HOST-ONLY at the USER AGENT, which is G180`s threat refused before our code ' +
          'runs: a sibling subdomain can neither set it nor overwrite it.',
      )
      assert.match(
        set,
        /(^|;\s*)Path=\/(\s*;|$)/,
        'NO `Path=/`. A `__Host-`-prefixed cookie without it is REFUSED OUTRIGHT by the ' +
          `browser, and the failure is silent — no error, no cookie. Saw: ${set}`,
      )
      assert.doesNotMatch(
        set,
        /(^|;\s*)Domain=/i,
        'A `Domain` ATTRIBUTE IS PRESENT. The `__Host-` prefix forbids it, so the browser ' +
          'refuses the cookie silently — and a `Domain` cookie is precisely the ' +
          `domain-scoped shadow cookie tossing depends on. Saw: ${set}`,
      )
    }
  })

  it('1c · the withdrawal matches the delivery attribute for attribute, plus `Max-Age=0`', () => {
    const cleared = withdrawnSessionCookie()
    assert.ok(cleared.startsWith(`${SESSION_COOKIE}=;`), `the clear names something else: ${cleared}`)
    assert.match(cleared, /(^|;\s*)Max-Age=0(\s*;|$)/, `the clear does not expire: ${cleared}`)

    /* 🛑 THE ATTRIBUTES MUST AGREE OR THE CLEAR IS A NO-OP. A browser matches a
       clearing `Set-Cookie` to a stored cookie by name, domain and path, and a
       `__Host-` clear that dropped `Secure` would be refused outright — leaving
       the LIVE cookie in place while the server believed it had withdrawn it.
       Compared as the shared suffix rather than attribute by attribute, so a
       future attribute added to one and not the other is a red here. */
    const attrsOf = (v: string): string[] =>
      v.split(';').slice(1).map((a) => a.trim()).filter((a) => a !== '' && !a.startsWith('Max-Age'))
    assert.deepEqual(
      attrsOf(cleared),
      attrsOf(mintedSessionCookie(HANDLE)),
      'the clear and the delivery carry DIFFERENT attributes. The browser will not match ' +
        'them, so the clear silently leaves the live cookie in place.',
    )
  })
})

describe('§2 · reading the cookie back', () => {
  it('2a · finds the handle, and ignores every other cookie beside it', () => {
    assert.equal(sessionCookieFrom(withCookie(`${SESSION_COOKIE}=${HANDLE}`)), HANDLE)
    assert.equal(
      sessionCookieFrom(withCookie(`theme=dark; ${SESSION_COOKIE}=${HANDLE}; tenantId=ten_globex`)),
      HANDLE,
      'the parser could not find the handle among ordinary cookies',
    )
  })

  it('2b · is exact about the name — a prefix, a suffix and a case change are all misses', () => {
    for (const name of [
      'reconcile_session',
      `x${SESSION_COOKIE}`,
      `${SESSION_COOKIE}_2`,
      SESSION_COOKIE.toUpperCase(),
    ]) {
      assert.equal(
        sessionCookieFrom(withCookie(`${name}=${HANDLE}`)),
        undefined,
        `\`${name}\` was accepted as the session cookie. Cookie names are case-sensitive ` +
          'and the `__Host-` prefix is part of the name; a parser that matched loosely ' +
          'would accept a cookie a sibling subdomain IS allowed to set.',
      )
    }
  })

  it('2c · 🛑 A DUPLICATE NAME IS REFUSED, NOT RESOLVED — the wire signature of cookie tossing', () => {
    const tossed = `${SESSION_COOKIE}=${HANDLE}; ${SESSION_COOKIE}=attacker-chosen`
    assert.equal(
      sessionCookieFrom(withCookie(tossed)),
      undefined,
      'THE PARSER PICKED ONE OF TWO. A `Cookie` header carrying the name twice is a ' +
        'host-only cookie and a domain-scoped shadow of it arriving together, in an order ' +
        'no browser promises and no server can attribute. Taking the first hands the ' +
        'attacker a coin flip; taking neither costs a correct browser nothing.',
    )
    /* And the order does not rescue it — the attacker may be first. */
    assert.equal(
      sessionCookieFrom(withCookie(`${SESSION_COOKIE}=attacker-chosen; ${SESSION_COOKIE}=${HANDLE}`)),
      undefined,
    )
  })

  it('2d · an absent, empty or valueless cookie is `undefined` and never an empty handle', () => {
    assert.equal(sessionCookieFrom(withCookie(undefined)), undefined)
    assert.equal(sessionCookieFrom(withCookie('')), undefined)
    assert.equal(sessionCookieFrom(withCookie(`${SESSION_COOKIE}=`)), undefined,
      'an empty value became an empty handle. `digestOfHandle("")` is a digest of nothing ' +
      'and would be compared against a column, which is a lookup nobody intended.')
    assert.equal(sessionCookieFrom(withCookie('theme=dark')), undefined)
  })

  it('2e · the harness spells the cookie the same way the server does', () => {
    /* 🛑 THE DUPLICATION IS DELIBERATE AND THIS IS THE CHECK THAT MAKES IT
       SAFE. `tests/http/harness.ts` writes the name out rather than importing
       it, so that a RENAME — which signs every live session out — is a red in
       the suites rather than a change both sides make together. This one
       assertion is where the two spellings are required to agree. */
    assert.equal(HARNESS_SPELLING, SESSION_COOKIE)
    assert.equal(sessionCookie(HANDLE)['cookie'], `${SESSION_COOKIE}=${HANDLE}`)
  })
})

describe('§3 · G386`s fence is STRUCTURAL — a property of the source tree', () => {
  const dataPlane = join(REPO_ROOT, 'server', 'data-plane')
  const files = readdirSync(dataPlane).filter((f) => f.endsWith('.ts'))

  it('3a · nothing under `server/data-plane/` statically imports `server/dev/`', () => {
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(join(dataPlane, file), 'utf8')
      for (const line of text.split('\n')) {
        /* A STATIC import only. `await import('../dev/…')` is the fence
           itself and must not be flagged — `server/data-plane/session.ts`
           holds exactly two of those and they are the point. */
        if (/^\s*import\s[^\n]*from\s+'\.\.\/dev\//.test(line)) offenders.push(`${file}: ${line.trim()}`)
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'A STATIC IMPORT FROM `server/data-plane/**` TO `server/dev/**` HAS APPEARED, AND IT ' +
        'CONVERTS A PROPERTY INTO AN INTENTION. G192, restated by G386: *"a plane started ' +
        'without the flag never LOADS the file, so there is no accepting code path in the ' +
        'process to bypass."* A static import is loaded whatever the flag says, and it also ' +
        'lets any bundler or container build starting from `main.ts` pull the file into the ' +
        `image. Reproduce: grep -rn "from '../dev/" server/data-plane/. Saw: ${JSON.stringify(offenders)}`,
    )
  })

  it('3b · no file under `server/data-plane/` holds the header name AS A VALUE', () => {
    /**
     * 🛑 HOLDING THE NAME IS THE STEP BEFORE READING IT, AND THAT IS WHY THIS
     * IS AN ASSERTION RATHER THAN A STYLE NOTE. `server/data-plane/session.ts`
     * exported `const SESSION_HEADER = 'x-session'` until G386 and read it on
     * every request; a production module that still held the constant would be
     * ONE LINE from reading it again, and the grep in 3a would keep returning
     * nothing while the property rotted. The name lives in
     * `server/dev/session-header.ts` and nowhere else on this plane.
     *
     * ⚠️ A QUOTED LITERAL, NOT A MENTION, AND THE NARROWING IS THE WHOLE
     * DIFFERENCE BETWEEN A CONTROL AND A LINT. The first draft flagged ANY
     * occurrence and went red on six lines, every one of them PROSE — including
     * the banner in `session.ts` that records this very correction and the
     * `detail` sentence a 401 carries. This record narrates its own
     * corrections; an assertion that forbade naming the thing corrected would
     * forbid the correction. What is forbidden is a VALUE a module could read a
     * header with.
     */
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(join(dataPlane, file), 'utf8')
      text.split('\n').forEach((line, i) => {
        const trimmed = line.trim()
        /* Prose is not a value. A docblock or a `//` line may narrate the
           header freely — see the note above. */
        if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return
        if (/['"`]x-session['"`]/i.test(line)) offenders.push(`${file}:${i + 1}: ${trimmed}`)
      })
    }
    assert.deepEqual(
      offenders,
      [],
      'THE DATA PLANE NAMES `X-Session` AGAIN. Under G386 the production credential is the ' +
        'cookie and the header is reachable only through `server/dev/session-header.ts`, ' +
        'behind the dynamic import the flag gates. If this is a comment, move it to the dev ' +
        `module; if it is code, the fence is gone. Saw: ${JSON.stringify(offenders)}`,
    )
  })

  it('3c · BASE CONTROL — the two greps above CAN fail, on a tree that deserves it', () => {
    /* 🛑 §5.6. Both assertions above are "a list is empty", which is what a
       broken scanner also reports. These run the same two patterns over text
       that MUST match, so a scanner that silently reads nothing is red here
       rather than green there. */
    const staticImport = "import { verifyTestToken } from '../dev/test-token.ts'"
    assert.match(staticImport, /^\s*import\s[^\n]*from\s+'\.\.\/dev\//,
      'the static-import pattern does not match a static import, so 3a asserts nothing')
    assert.doesNotMatch("  const { verifyTestToken } = await import('../dev/test-token.ts')",
      /^\s*import\s[^\n]*from\s+'\.\.\/dev\//,
      'the static-import pattern matches a DYNAMIC import, so 3a would forbid the fence itself')
    assert.match("  const raw = request.headers['x-session']", /['\"`]x-session['\"`]/i,
      'the header pattern does not match a header read, so 3b asserts nothing')
    assert.doesNotMatch(' * the X-Session header is read only by a plane started with the flag',
      /['\"`]x-session['\"`]/i,
      'the header pattern matches PROSE, so 3b would forbid this record narrating its own ' +
      'correction — which is the one thing CLAUDE.md requires it to do')
  })

  it('3d · and the dev module that DOES name it is reached only by a dynamic import', () => {
    const session = readFileSync(join(dataPlane, 'session.ts'), 'utf8')
    assert.match(
      session,
      /await import\('\.\.\/dev\/session-header\.ts'\)/,
      '`server/data-plane/session.ts` no longer reaches the header reader through a dynamic ' +
        'import. Either the header arm was deleted — in which case say so — or it was made ' +
        'static, which is the fence gone.',
    )
    /**
     * ⚠️ THE PATTERN WAS AMENDED ON 19 Sep 2026 AND THE AMENDMENT IS RECORDED
     * RATHER THAN MADE QUIETLY — G726. **It read
     * `/if \(!localTestAuthEnabled\(\)\) return databaseReader\(pool,
     * sessionCookieFrom\)/`**, pinning the whole line including its closing
     * paren, and it went RED when `databaseReader()` took a THIRD argument:
     * the two host registries, so the reader can tell a tenant host from a
     * console host.
     *
     * 🛑 THE PROPERTY IT PROTECTS IS UNCHANGED AND THE PATTERN STILL STATES
     * IT, which is the only reason this is an amendment and not a deletion:
     * the flag is tested at the TOP, the production arm RETURNS there, and the
     * channel it is handed is `sessionCookieFrom` and nothing else. **What is
     * no longer pinned is the end of the argument list** — which was never the
     * claim, and pinning it made the assertion fail on a change that touched
     * no channel at all. §5.1: a rule keyed on a convenient landmark rather
     * than on the property it protects.
     *
     * ⚠️ `[^)]*` RATHER THAN `.*`, so the match cannot run past the call and
     * pick up a `sessionHeaderFrom` on a later line.
     */
    assert.match(
      session,
      /if \(!localTestAuthEnabled\(\)\) \{?\s*\n?\s*return databaseReader\(\s*pool,\s*sessionCookieFrom[^)]*\)/,
      'THE PRODUCTION READER NO LONGER TAKES THE COOKIE ALONE. That one line IS G386: a ' +
        'plane without the flag returns before either dev module is imported, so there is ' +
        'no accepting code path for the header in the process. A conditional inside the ' +
        'reader instead would be *"a boolean check inside a request handler"*, which the ' +
        'ruling refuses by name.',
    )
  })
})

describe('§4 · the clients declare the narrow `credentials`, and never the wide one', () => {
  /**
   * 🛑 THIS SECTION EXISTS BECAUSE A MUTATION PROVED IT HAD TO.
   *
   * Deleting `credentials: 'same-origin'` from `frontend/src/api/runs.ts`
   * entirely and rebuilding the bundle left **every assertion in
   * `tests/e2e/browser-login.test.ts` green** — 15 pass, 0 fail. That is not a
   * flaw in that suite: `'same-origin'` IS the browser's default for a
   * same-origin `fetch`, so removing it changes nothing observable in an
   * arrangement that is same-origin by construction. **A declaration whose
   * deletion no test notices is documentation, and this repository's rule is
   * that a control has to be witnessed.**
   *
   * ⚠️ SO WHAT IS ASSERTED HERE IS THE SOURCE, NOT THE BEHAVIOUR, AND THE
   * NARROWNESS IS THE POINT. The dangerous edit is not deleting the line — it
   * is widening it to `'include'`, which sends the cookie CROSS-ORIGIN the day
   * anybody adds CORS, to whatever host `?plane=` named. No runtime assertion
   * available here can see that, because the deployed and dev arrangements are
   * both same-origin and would stay green; the difference is visible only in
   * the text. This is the same kind of control as §3 and is honest about being
   * one.
   */
  const clients = ['runs.ts', 'exceptions.ts']

  for (const file of clients) {
    it(`4a · \`frontend/src/api/${file}\` declares \`credentials: 'same-origin'\``, () => {
      const text = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'api', file), 'utf8')
      assert.match(
        text,
        /credentials:\s*'same-origin'/,
        `\`${file}\` no longer declares \`credentials: 'same-origin'\`. Under G386 this is the ` +
          'only thing that says where the session cookie may go, and the browser default ' +
          'that currently agrees with it is a default — not a decision somebody took.',
      )
    })

    it(`4b · and NEVER \`credentials: 'include'\``, () => {
      const text = readFileSync(join(REPO_ROOT, 'frontend', 'src', 'api', file), 'utf8')
      assert.doesNotMatch(
        text,
        /credentials:\s*'include'/,
        `\`${file}\` WIDENED TO \`'include'\`. That sends the session cookie to whatever ` +
          'origin the caller named — and `?plane=` is a value that arrives in a LINK. It is ' +
          'inert only while no plane serves CORS; `grep -rn "cors" server/` returns nothing ' +
          'TODAY, and a `credentials` value is not the place to rest on that.',
      )
    })
  }

  it('4c · BASE CONTROL — both patterns match the strings they are about', () => {
    /* §5.6 again: `doesNotMatch` is what a broken pattern also reports. */
    assert.match("    credentials: 'same-origin',", /credentials:\s*'same-origin'/)
    assert.match("    credentials: 'include',", /credentials:\s*'include'/)
    assert.doesNotMatch("    credentials: 'same-origin',", /credentials:\s*'include'/)
  })
})
