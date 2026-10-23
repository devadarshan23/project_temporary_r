/**
 * THE PUBLIC MARKETING PLANE IS NOT A THIRD `ServedSurfaceKind` — AND SINCE
 * G2021, ADDING ONE IS A COMPILE ERROR RATHER THAN A SILENT TENANT.
 *
 * ⚠️ **THIS HEADLINE READ *"AND THE REASON IS THAT NOTHING WOULD READ ONE"*
 * UNTIL 22 Sep 2026, AND IT IS CORRECTED RATHER THAN DELETED BECAUSE IT WAS
 * THE SLICE'S WHOLE ARGUMENT.** It was a MEASUREMENT (G1922, G1923) and it was
 * accurate; it was also the reason the member would have been dangerous rather
 * than inert, which is the opposite of what a reader takes from those words.
 * **Both readers now answer one**, so what remains true is only the first
 * clause: no third member is NEEDED, and none is added.
 *
 * G1921–G1926 and **G2021–G2026 (22 Sep 2026)**, **DERIVED, NOT THE OWNER'S**,
 * as G190, G356, G376, G511, G531, G533, G576, G602, G782, G783, G912, G913,
 * G914, G941, G961, G1091, G1122 and G1162 are.
 *
 * ┌─ 🛑 READ THIS BEFORE THE REST: AN ADVERSARIAL PASS FALSIFIED THREE OF ────┐
 * │ THIS FILE'S OWN CLAIMS ON THE DAY IT LANDED, AND THE REPAIRS ARE IN HERE. │
 * │ Every corrected sentence is QUOTED where it stood rather than deleted,    │
 * │ because each is one a reader would have carried onward.                   │
 * │                                                                            │
 * │  · **G1921 SAID `resolveServedHost()` IS *STRUCTURALLY* UNREACHABLE FROM  │
 * │    A PUBLIC-PLANE REQUEST, AND §1a's MESSAGE SAID *"no public request has │
 * │    ever reached it."* THAT IS TRUE OF ONE OPERATION AND FALSE OF THE      │
 * │    TIER** — the session tier declares FOUR operations and TWO are         │
 * │    `secured: true`, `caller: 'person'`. See §2a2. The word is dropped.    │
 * │  · **G1922 DECLINED THE `never` GUARD. THE GUARD IS TAKEN — G2021 — AND   │
 * │    THE ROW IS AMENDED.** §3 is rewritten around it and now asserts a      │
 * │    PRESENCE where it asserted an absence.                                 │
 * │  · **FIVE SCANNERS WERE KEYED ON SPELLINGS AND FIVE BYPASSES PASSED AT    │
 * │    15 OF 15 — G2022.** Each is named at the assertion it defeated, and    │
 * │    each re-keyed assertion was witnessed RED against the bypass above it. │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS FILE IS FOR ───────────────────────────────────────────────────┐
 * │ A slice was planned on the assumption that a public marketing plane needs │
 * │ a THIRD member of `SERVED_SURFACE_KINDS` — `model/serving-host.ts` §8     │
 * │ declares exactly `tenant` and `console`. **It does not, and this file is  │
 * │ the measurement rather than the assertion.** It is the shape              │
 * │ `db/migrations/0004_subject_ledger.sql` fixes for a COLUMN and G1125 and  │
 * │ G306 apply to a column and to a field: *a member ahead of its reader.*    │
 * │                                                                            │
 * │ **The deliverable of a refusal is a control, not a diff.** Every           │
 * │ assertion below is a thing the commit that DOES need a third member must  │
 * │ delete on purpose, having read why it was written.                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DECIDED ARCHITECTURE, IN THREE SENTENCES, BECAUSE THE WHOLE FINDING
 *    TURNS ON IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. The apex `reconcileai.app` is served by **Amplify** — `infra/lib/
 *      config.ts`'s `EDGE_APEX_IS_SERVED_ELSEWHERE`, G298, and
 *      `docs/build/deploy-handoff.md` §5.4's *"a different tool for a
 *      different job"*. It is on NEITHER certificate and NEITHER CloudFront
 *      distribution, so no request to it reaches a plane through the Edge
 *      stack at all.
 *   2. `/lookup` posts SAME-ORIGIN to the apex, and an **Amplify rewrite** —
 *      a server-side proxy, not a redirect — carries **ONE path** on to the
 *      CONSOLE distribution. **The apex terminates at Amplify**; the `Host`
 *      the plane would eventually see is the one the proxy presents to
 *      CloudFront, and §4 measures which names that distribution answers for.
 *      ⚠️ **THIS SAID `/session/*` AND IS CORRECTED RATHER THAN DELETED —
 *      G2023.** The sibling slice that BUILDS the apex narrowed its proxy to
 *      `MARKETING_PROXIED_PLANE_PATHS = ['/session/realm']` and refuses the
 *      `/session/<*>` widening AT SYNTH, with a red fixture
 *      (`infra/test-fixtures/amplify-session-bearing-path.ts`), because
 *      `/session/federated` MINTS a session and a 200 rewrite is invisible to
 *      the browser — so the cookie would bind to the apex and G180 would
 *      revoke it at the real host. **This file's conclusion survives the
 *      narrowing and is strengthened by it**: the one proxied path is exactly
 *      `resolveHomeRealm`'s, and `resolveHomeRealm` is the operation §2
 *      measures.
 *   3. `resolveHomeRealm` declares no `security` and does not override a tier
 *      that declares `security: []`. **So THAT OPERATION is one the
 *      authenticator never runs for** — and the authenticator is the ONLY
 *      caller of `resolveServedHost()` in this repository. §2 drives it over a
 *      real plane. ⚠️ **THE PROPERTY IS PER OPERATION AND NEVER PER TIER, AND
 *      THE DISTINCTION IS G911's**: `server/contract/routes.ts` derives
 *      `secured` from the operation's own `security` with a document-level
 *      fallback, and G911 retired `TIER_REQUIRES_CAPABILITY` on the grounds
 *      that *"the file boundary should not carry an authorisation decision."*
 *      **§2a2 measures the two operations on this very tier that ARE secured**,
 *      so nobody inherits the retired reading from a message written here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 AND §3 IS NOW A PRESENCE WHERE IT WAS AN ABSENCE — G2021, THE GUARD.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **THIS BLOCK READ:** *"`CLAUDE.md` says 'Prefer a total `Record<K, V>` …'
 * and the reason is that an unhandled member becomes a compile error. **There
 * is no total `Record` over `ServedSurfaceKind` anywhere in this repository** —
 * §3a measures it — so a third member raises **ZERO `TS1360`s** and nobody is
 * asked anything. Every one of the three readers narrows with a BINARY
 * `=== console` or `=== tenant`, so a `public` surface would fall through and
 * be resolved **as a tenant subject**, silently (§3b)."* **Every measurement in
 * it was correct and the CONCLUSION it was used for was not.** It is corrected
 * rather than deleted because G1922 and G1923 are written on top of it.
 *
 * **THE GUARD IS TAKEN.** `resolveSubject()` and `surfaceOf()` each carry an
 * exhaustive `switch` with a `never` default — the idiom
 * `model/reconciliation.ts`'s `uniquenessPreflight()` already uses for `Expr`'s
 * six arms, so it is this repository's own form and not a new one. **Witnessed:
 * `public: 'public'` added to `SERVED_SURFACE_KINDS` is now `TS2322` in BOTH
 * `tsc -p model/` and `tsc -p server/`, where G1922 measured EXIT 0 in both.**
 *
 * 🛑 **AND THE POLARITY IS WHY, BECAUSE G1922's REFUSAL RESTED ON READING IT
 * BACKWARDS.** That row declined the guard as *"a control for a hazard nothing
 * can create"*, on `db/migrations/0004`'s *a member ahead of its reader*. **A
 * `default: never` is not a member ahead of a reader; it is a READER ahead of a
 * member** — and `db/migrations/0069` states that polarity in as many words:
 * *"an UNKNOWN value must reach the model as an `*_unreadable` refusal, not be
 * rejected at write time by a list somebody forgot to extend."* `0069` applies
 * it to `slot_cardinality_unreadable`; `SESSION_REFUSALS.surfaceUnreadable` is
 * the same sentence about a surface.
 *
 * ⚠️ **THE TWO GUARDS COVER TWO DIFFERENT AXES AND NEITHER COVERS BOTH.**
 * `resolveSubject()` switches on `ServedSurfaceKind`, so a third CONST MEMBER
 * is the error; `surfaceOf()` switches on a `ServedSurface` VALUE, so a third
 * UNION ARM is — including one spelled as a bare literal that never touches the
 * const, which is the bypass that defeated §1a and §1b together (G2022).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT IS NOT BUILT, STATED HERE RATHER THAN LEFT TO BE FOUND — G1926.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The path this file reasons about does not exist yet, and the finding is a
 * statement about what the MODEL owes rather than about a working route.**
 *
 *   · `infra/` declares NO Amplify construct — `grep -rniE amplify infra/lib
 *     infra/bin` returns ONE line, and it is prose in `config.ts` — so the
 *     apex is served by a ruling rather than by a synthesised template, and
 *     nothing in `npm run check` can see whether the rewrite exists or what
 *     it targets. **Scope the grep to the tracked sources: `infra/` alone
 *     walks `node_modules` and answers 614.**
 *   · The CONSOLE distribution has **no plane origin**: its own `comment`
 *     says so, `EDGE_PLANE_PATH_PATTERNS` reaches `additionalBehaviors` on the
 *     TENANT distribution alone, and giving it one is a sibling slice.
 *   · `resolveHomeRealm` is DECLARED AND MOUNTED NOWHERE —
 *     `grep -rn 'handlers:' server/` — so §2b drives an operation
 *     the real plane 404s. **That is why §2b mounts its own bare handler**:
 *     the claim is about the HOOK's ordering, which is the same for a mounted
 *     operation and an unmounted one.
 *
 * 🛑 AND ONE PROSPECTIVE CONSEQUENCE, NAMED BEFORE IT IS MET: a session minted
 * through an apex proxy would set `__Host-reconcile_session` on the APEX
 * origin, while `checkHostBinding()` compares the presented `Host` against
 * `issuedHost` and **REVOKES on a mismatch (G180)** — so the first request to
 * a tenant host would revoke the session it had just minted. It is unreachable
 * today only because `completeFederatedSignIn` is unmounted and nothing here
 * mints a session at all (G978).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import {
  buildPlane,
  servedPublicly,
  servedWithoutAGate,
  type MountedHandler,
} from '../../server/http/app.ts'
import { basePathOf, loadTier, TIERS, type TierName } from '../../server/contract/document.ts'
import { routesOf } from '../../server/contract/routes.ts'
import { resolveSubject, SESSION_REFUSALS } from '../../model/access.ts'
import { acmeEntraConnection, acmeScopedSession } from '../../model/examples.ts'
import type { Timestamp } from '../../model/kernel.ts'
import {
  resolveServedHost,
  SERVED_HOST_REFUSALS,
  SERVED_SURFACE_KINDS,
  type ServedSurfaceKind,
} from '../../model/serving-host.ts'
/**
 * 🛑 THE EDGE'S OWN CONSTANTS, IMPORTED AND NEVER RE-SPELLED — G2022,
 * 22 Sep 2026, AND `tests/e2e/single-origin.ts` IS THE PRECEDENT.
 *
 * ⚠️ **§2e AND §4a BOTH RESTED ON A SPELLING BEFORE THIS.** §2e did not exist
 * and the prose above it described the published path set from memory; §4a
 * compared `domainNames` ENTRIES against the IDENTIFIER `ROOT_DOMAIN` and the
 * LITERAL `'reconcileai.app'`, so `const APEX_ALIAS = ROOT_DOMAIN` walked
 * straight through it — **measured, at 15 of 15 passing, with the apex on the
 * TENANT distribution's aliases.** A rule keyed on a convenient landmark
 * instead of the property it protects is `docs/HANDOFF.md` §5.1, and this
 * import is what lets §4a key on the VALUE.
 *
 * ⚠️ `infra/lib/config.ts` HAS NO IMPORTS AND MUST KEEP NONE, which is what
 * makes this free: the gate type-checks `tests/` FROM THE ROOT, where
 * `aws-cdk-lib` is deliberately absent under G259/G212, so the day that file
 * imports a construct library `npm run typecheck:tests` goes red.
 */
import * as edgeConfig from '../../infra/lib/config.ts'
import { APEX_HOST, EDGE_PLANE_PATH_PATTERNS, edgePatternMatches } from '../../infra/lib/config.ts'
import { APEX_PAGES, apexUrlFor } from '../../frontend/src/routes/apex.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const MODEL_DIR = path.join(REPO_ROOT, 'model')
const SERVER_DIR = path.join(REPO_ROOT, 'server')

/** The apex. Spelled here rather than imported — see §4a. */
const APEX = 'reconcileai.app'

/**
 * The operation `/lookup` would post to. `docs/contracts/session.openapi.yaml`
 * A1, `POST /session/realm`, and it is the operation the pack's public-plane
 * `/lookup` row describes: *"they type a work email and we route them to their
 * own host."*
 */
const PUBLIC_OPERATION = 'resolveHomeRealm'
const PUBLIC_PATH = '/session/realm'

interface Caller {
  readonly tenantId: string
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFilesUnder(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/**
 * Comments stripped, so an absence read off a source file is an absence in the
 * CODE rather than in the prose about it.
 *
 * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS NAMED — a `//` or `/*`
 * inside a string literal is mis-stripped. `administration-tier-unmounted`
 * states the same caveat for the same helper, and the guard is the same: §0
 * asserts the stripper left real code behind before any absence is read.
 */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * A plane built the way a real one is, over the REAL documents, with an
 * authenticator that COUNTS ITS OWN CALLS.
 *
 * 🛑 THE COUNTER IS THE INSTRUMENT AND IT IS WHY THIS FILE NEEDS NO DATABASE.
 * `resolveServedHost()` is reached from exactly one place —
 * `server/data-plane/session.ts`'s `surfaceOf()`, called inside the session
 * reader — and the session reader IS `options.authenticate`. So *"did this
 * request reach the surface lookup"* reduces to *"was `authenticate` called"*,
 * which is observable with no pool, no rows and no `pg`.
 */
function countingPlane(
  tier: TierName,
  handlers: Readonly<Record<string, MountedHandler>>,
): { build: () => Promise<Awaited<ReturnType<typeof buildPlane>>>; calls: () => number } {
  let calls = 0
  return {
    calls: () => calls,
    build: () =>
      buildPlane<Caller>(
        {
          plane: 'test-public-plane',
          authenticate: () => {
            calls += 1
            return { tenantId: 'ten_probe' }
          },
          unauthenticatedDetail: 'no session',
          authorise: () => 'held',
          unauthorisedDetail: 'no capability',
        },
        [{ tier, handlers }],
      ),
  }
}

/* ==================================================================== *
 * §0 · THE §5.6 GUARD. Every absence below is a claim about a union
 *      with two members; if nothing loaded, all of them are free.
 * ==================================================================== */

describe('§0 · the derivation reaches something', () => {
  it('0a · the session tier is registered and its document parses', () => {
    assert.equal(TIERS.session, 'session.openapi.yaml')
    const routes = routesOf(loadTier('session'), basePathOf(loadTier('session')))
    assert.ok(
      routes.some((r) => r.operationId === PUBLIC_OPERATION),
      `\`${PUBLIC_OPERATION}\` is not declared on the session tier any more. Every assertion ` +
        'below is about the operation `/lookup` posts to; if it has moved, this file is ' +
        'measuring nothing.',
    )
  })

  it('0b · the comment stripper leaves real code behind', () => {
    const files = [...sourceFilesUnder(MODEL_DIR), ...sourceFilesUnder(SERVER_DIR)]
    assert.ok(files.length > 20, `only ${String(files.length)} source file(s) were walked`)
    const stripped = codeOf(readFileSync(path.join(MODEL_DIR, 'serving-host.ts'), 'utf8'))
    assert.ok(
      stripped.includes('export function resolveServedHost'),
      'the stripper removed the declaration it was pointed at, so §3 would read absence out of ' +
        'a file it had emptied',
    )
  })
})

/* ==================================================================== *
 * §1 · THE TWO-MEMBER SET — THE ASSERTION A THIRD MEMBER MUST DELETE.
 * ==================================================================== */

describe('§1 · `SERVED_SURFACE_KINDS` has two members and a third is REFUSED', () => {
  it('1a · exactly `tenant` and `console`, and nothing else', () => {
    assert.deepEqual(
      Object.values(SERVED_SURFACE_KINDS).slice().sort(),
      ['console', 'tenant'],
      [
        'A THIRD SERVED SURFACE HAS BEEN ADDED. That may be right — but it is a decision, and',
        'this assertion is where it gets taken rather than inherited. Before moving it, answer',
        'the three questions §2, §3 and §4 measure:',
        '',
        '  · §2 WHO READS IT. `resolveServedHost()` has exactly one caller —',
        '    `surfaceOf()` inside `server/data-plane/session.ts`\'s session reader — and the',
        '    session reader is `options.authenticate`, which `server/http/app.ts` runs ONLY',
        '    for a route the DOCUMENT marks `security`. THE OPERATION `/lookup` REACHES —',
        '    `resolveHomeRealm` — DECLARES NONE, so no request to THAT OPERATION has ever',
        '    reached it. §2b measures it.',
        '',
        '    ⚠️ THE PROPERTY IS PER OPERATION AND NEVER PER TIER, AND AN EARLIER DRAFT OF',
        '    THIS BULLET SAID "a tier that declares `security: []`, so no public request',
        '    has ever reached it" — WHICH IS FALSE ABOUT THIS VERY TIER. `session` declares',
        '    FOUR operations and TWO are `secured: true`, `caller: person`: `getSession`',
        '    (GET /session) and `signOut` (DELETE /session). Both run `authenticate` and',
        '    therefore both reach `resolveServedHost()` with whatever `Host` arrives. §2a2',
        '    measures them. `server/contract/routes.ts` derives `secured` from the',
        '    OPERATION with a document-level fallback, and G911 retired',
        '    `TIER_REQUIRES_CAPABILITY` because "the file boundary should not carry an',
        '    authorisation decision" — so a message written to be INHERITED must not',
        '    reinstate the reading that ruling retired.',
        '',
        '  · §3 WHAT THE COMPILER ASKS. Since G2021 it asks, and that is the whole of what',
        '    changed: `resolveSubject()` and `surfaceOf()` each carry an exhaustive `switch`',
        '    with a `never` default, so a third member is a `TS2322` in BOTH `tsc -p model/`',
        '    and `tsc -p server/`. ⚠️ THIS BULLET READ "Nothing. There is no total `Record`',
        '    over `ServedSurfaceKind`, and all three narrowings are binary, so a third',
        '    member is silently resolved AS A TENANT" — which was MEASURED and TRUE, and is',
        '    G1922 and G1923. The compile error is where you find out; §3b is what happens',
        '    to a value that arrives through a cast anyway.',
        '',
        '  · §4 WHAT `Host` THE PLANE WOULD SEE. The apex is served by Amplify and is on',
        '    neither certificate and neither distribution; an Amplify rewrite is a proxy, so',
        '    the name that reaches CloudFront is one the CONSOLE distribution answers for and',
        '    the console registry already resolves.',
      ].join('\n'),
    )
  })

  it('1b · and `ServedSurface` has exactly two arms — COUNTED, not spelled', () => {
    /**
     * A union has no runtime form, so this reads the declaration. It is the
     * other half of §1a deliberately: §1a pins the VALUES a reader dispatches
     * on, this pins the SHAPES a reader may narrow to.
     *
     * 🛑 **IT COUNTS `kind:` OCCURRENCES AND NO LONGER MATCHES THE SPELLING
     * `typeof SERVED_SURFACE_KINDS.X` — G2022, AND THE RE-KEY IS A MEASURED
     * REPAIR RATHER THAN A TIDY-UP.** This assertion's own comment used to
     * claim that *"a slice that added a member to one and not the other would
     * be caught by exactly one of them"*, and **that was false, measured: a
     * third arm spelled `{ readonly kind: 'public' }` — a BARE LITERAL, with
     * `SERVED_SURFACE_KINDS` untouched — left §1a green (the const did not
     * move) AND §1b green (the regex found no third `typeof
     * SERVED_SURFACE_KINDS.` and reported the same two arms). The suite was
     * 15 of 15.** The old regex keyed on how an arm was SPELLED; the property
     * is how many arms there ARE.
     *
     * ⚠️ **AND `tsc -p server/` DID CATCH THAT BYPASS, WHICH IS WORTH STATING
     * SO NOBODY READS THIS RE-KEY AS CLOSING A HOLE THE GATE HAD:**
     * `surfaceOf()` returns `ServedSurfaceKind`, so a widened `ServedSurface`
     * was a `TS2322` on the return. **The gate was red and this file was
     * green, which is the worse half** — a control that reports OK about the
     * thing it is named for teaches a reader to trust it. Since G2021 the
     * `never` binding in `surfaceOf()` catches the same arm by NAME rather
     * than incidentally.
     */
    const source = codeOf(readFileSync(path.join(MODEL_DIR, 'serving-host.ts'), 'utf8'))
    const union = /export type ServedSurface =([\s\S]*?)\n\nexport /.exec(source)?.[1] ?? ''
    assert.notEqual(union, '', '`ServedSurface` could not be located in `model/serving-host.ts`')
    const arms = [...union.matchAll(/\bkind:/g)]
    assert.equal(
      arms.length,
      2,
      `\`ServedSurface\` declares ${String(arms.length)} arm(s) and this assertion demands two. ` +
        'It counts `kind:` rather than a spelling, so an arm written as a bare literal moves ' +
        'it exactly as one written `typeof SERVED_SURFACE_KINDS.x` does. See §1a for what ' +
        'moving this costs.',
    )
    /* The anti-vacuity half: a regex that matched nothing would read as two
     * arms having become zero, not as a broken scan. */
    assert.match(
      union,
      /SERVED_SURFACE_KINDS\.tenant[\s\S]*SERVED_SURFACE_KINDS\.console/,
      'the two arms this file knows about are no longer both spelled against the const, so ' +
        'the count above is measuring something other than what §1a measures',
    )
  })
})

/* ==================================================================== *
 * §2 · THE TRACE, DRIVEN. An unauthenticated public-plane request is
 *      SERVED without the surface lookup running at all.
 * ==================================================================== */

describe('§2 · a public-plane request never reaches `resolveServedHost()`', () => {
  it('2a · the operation is UNSECURED and its caller is `none`, per the real document', () => {
    const doc = loadTier('session')
    const spec = routesOf(doc, basePathOf(doc)).find((r) => r.operationId === PUBLIC_OPERATION)
    assert.ok(spec !== undefined)
    assert.equal(
      spec.secured,
      false,
      'the session tier declares `security: []` at document level and this operation does not ' +
        'override it. If that has changed, the whole of §2 is about a different request.',
    )
    assert.equal(
      spec.caller,
      'none',
      '`callerOf([])` answers `none`, which is also why `mountTier()`\'s fourth fence lets ' +
        '§2b mount a bare handler here',
    )
  })

  it('2a2 · THE TIER IS NOT THE PROPERTY — three of its seven operations ARE secured', () => {
    /**
     * 🛑 **THIS ASSERTION EXISTS BECAUSE §1a's MESSAGE AND G1921's ROW BOTH
     * SAID THE WRONG THING, AND THE WRONG THING WAS GENERALISING §2a TO THE
     * TIER.** G1921 called `resolveServedHost()` *"STRUCTURALLY unreachable
     * from a public-plane request"* and §1a handed the next reader *"no public
     * request has ever reached it."* **Both are true of `resolveHomeRealm` and
     * false of `session.openapi.yaml`.**
     *
     * `getSession` (GET `/session`) and `signOut` (DELETE `/session`) are
     * `secured: true`, `caller: 'person'`. Each runs `authenticate` →
     * `databaseReader` → `surfaceOf()` → `resolveServedHost()`, **with
     * whatever `Host` arrives** — so the surface lookup is reached from this
     * tier on two of its four operations, and the word STRUCTURALLY is
     * dropped rather than argued.
     *
     * ⚠️ **AND THE GENERALISATION IS THE ONE G911 RETIRED.**
     * `server/contract/routes.ts` computes `secured` per OPERATION, falling
     * back to the document only when the operation states nothing; G911
     * retired `TIER_REQUIRES_CAPABILITY` on the ground that *"the file
     * boundary should not carry an authorisation decision."* A message
     * written to be inherited is exactly where that reading gets reinstated,
     * which is why this is an assertion and not a comment.
     *
     * 🛑 **THE CONCLUSION SURVIVES AND IS NARROWER: the operation a `/lookup`
     * proxy reaches is `resolveHomeRealm`, and the sibling slice that BUILDS
     * the apex proxies THAT PATH AND NO OTHER** —
     * `MARKETING_PROXIED_PLANE_PATHS = ['/session/realm']` in `infra/lib/
     * config.ts` on `worktree-agent-a550a06f64ab144a0`, with
     * `assertProxiesNoSessionBearingPath()` refusing the `/session/<*>`
     * widening AT SYNTH and `infra/test-fixtures/amplify-session-bearing-
     * path.ts` as the red witness. **So the two secured operations below are
     * unreachable from the apex because of a guard in `infra/`, not because
     * of a property of this tier** — and §2e is the executable half of that
     * distinction.
     */
    const doc = loadTier('session')
    const specs = routesOf(doc, basePathOf(doc))
    /* FIVE since 1 Oct 2026 — G2541 declared `beginFederatedSignIn`, which is
     * NOT secured (`security: []`, a caller with no credential), so the SECURED
     * set below is unchanged and the point of this section is too. */
    /* SIX since 2 Oct 2026 — G2762 declared `relayBrokerReturn`, `security: []`
     * like the begin, so the SECURED set below is unchanged again.
     * SEVEN since 3 Oct 2026 — G3354 declared `getSessionPrincipal`, which IS
     * secured (`sessionContext`, a person), so the SECURED set grows to three
     * and §2a2's point gets stronger rather than weaker. It is not proxied from
     * the apex: `MARKETING_PROXIED_PLANE_PATHS` is still `/session/realm` alone. */
    assert.equal(
      specs.length,
      7,
      `the session tier declares ${String(specs.length)} operation(s), not seven. This assertion ` +
        'is about the SET, so a change to it changes what the claim means.',
    )
    const secured = specs.filter((r) => r.secured).map((r) => r.operationId).sort()
    assert.deepEqual(
      secured,
      ['getSession', 'getSessionPrincipal', 'signOut'],
      'the secured operations on the session tier have changed. If this set became EMPTY, the ' +
        'tier-level reading G1921 wrongly used would have become true by accident — and it ' +
        'would still be the wrong rule, because `secured` is derived per operation ' +
        '(`server/contract/routes.ts`) and G911 retired the file boundary as an authorisation ' +
        'landmark. Re-read §1a before moving it.',
    )
    for (const id of secured) {
      assert.equal(
        specs.find((r) => r.operationId === id)?.caller,
        'person',
        `${id} no longer faces a person; §2a2's point is that a PERSON-facing secured ` +
          'operation on this tier runs the authenticator and therefore the surface lookup',
      )
    }
  })

  it('2b · MEASURED — the apex-borne request is served 200 and `authenticate()` runs ZERO times', async () => {
    /**
     * 🛑 THIS IS THE FINDING. The `Host` is the apex, which is the worst case
     * for the claim: it is the one name that could not possibly be in either
     * registry, so if anything anywhere consulted a registry for this request
     * the answer would be a refusal rather than a 200.
     *
     * ⚠️ **THE HANDLER WAS MOUNTED BARE UNTIL 1 Oct 2026 AND IS NOW WRAPPED IN
     * `servedPublicly()` — D6-8, G2241.** A bare public person-facing mount is
     * refused at boot by `server/http/app.ts`'s seventh fence, so the bare
     * form measures a boot failure rather than this finding. The mark changes
     * nothing a request sees; the measurement is unchanged.
     */
    const probe = countingPlane('session', {
      [PUBLIC_OPERATION]: servedPublicly(async () => ({ connectionId: 'idc_probe' })),
    })
    const app = await probe.build()
    try {
      const res = await app.inject({
        method: 'POST',
        url: PUBLIC_PATH,
        headers: { host: APEX, 'content-type': 'application/json' },
        payload: { domain: 'acme.example' },
      })
      assert.equal(
        res.statusCode,
        200,
        `\`POST ${PUBLIC_PATH}\` with \`Host: ${APEX}\` answered ${String(res.statusCode)}: ` +
          `${res.payload.slice(0, 200)}`,
      )
      assert.equal(
        probe.calls(),
        0,
        'THE AUTHENTICATOR RAN. `resolveServedHost()` is reached from inside it and nowhere ' +
          'else, so this number going above zero means a public-plane request now DOES ask ' +
          'which surface it arrived on — which is the premise a third `ServedSurfaceKind` ' +
          'needs. Read §1a, then take the decision there.',
      )
    } finally {
      await app.close()
    }
  })

  it('2b2 · AND THE SAME TIER RUNS IT ONCE FOR `getSession` AND ONCE FOR `signOut`', async () => {
    /**
     * 🛑 **THE MEASUREMENT THAT FALSIFIES THE TIER-LEVEL READING, DRIVEN
     * RATHER THAN ARGUED.** §2a2 reads the two operations' `secured` flag out
     * of the real document; this drives both over a real plane on the SAME
     * TIER §2b uses, with the SAME apex `Host`, and counts the authenticator.
     *
     * **If `session.openapi.yaml` made `resolveServedHost()` structurally
     * unreachable — G1921's word — these two counters would read zero.** They
     * read one each.
     *
     * ⚠️ `servedWithoutAGate()` IS REQUIRED HERE FOR §2c's REASON: both
     * operations are `exempt` and person-facing, so `mountTier()`'s fourth
     * fence (G914) refuses a bare handler. The mark acknowledges the
     * contract's own exemption and is not a claim by this file.
     */
    for (const [operationId, method, url] of [
      ['getSession', 'GET', '/session'],
      ['signOut', 'DELETE', '/session'],
    ] as const) {
      const probe = countingPlane('session', {
        [operationId]: servedWithoutAGate(async () => ({})),
      })
      const app = await probe.build()
      try {
        await app.inject({ method, url, headers: { host: APEX } })
        assert.equal(
          probe.calls(),
          1,
          `\`${method} ${url}\` (${operationId}) did not run the authenticator. §2a2 reads it ` +
            'as `secured: true`, and a secured operation reaching the reader is what makes ' +
            "§2b's zero a fact about ONE OPERATION rather than about this tier. If this is " +
            'now zero, §2a2 is where the change gets argued.',
        )
      } finally {
        await app.close()
      }
    }
  })

  it('2c · THE DIFFERENTIAL — the same authenticator DOES run for a secured operation', async () => {
    /**
     * §5.6, and it is not optional here: a counter that reads zero because the
     * instrument is broken proves nothing at all. `resolveTenantContext` is
     * `secured: true` with a person for a caller, so it is the nearest
     * operation to `resolveHomeRealm` that differs in exactly the property
     * §2b is about.
     *
     * ⚠️ `servedWithoutAGate()` IS REQUIRED AND IS NOT A CLAIM BY THIS FILE.
     * That operation is `exempt` and person-facing, so `mountTier()`'s fourth
     * fence refuses a bare handler for it — the mark acknowledges the
     * contract's own exemption, and `tests/http/per-operation-gate-verdict.test.ts`
     * §5a's census counts call sites under `server/`, which this is not.
     */
    const probe = countingPlane('foundation', {
      resolveTenantContext: servedWithoutAGate(async () => ({})),
    })
    const app = await probe.build()
    try {
      await app.inject({
        method: 'POST',
        url: '/context/resolve',
        headers: { host: APEX, 'content-type': 'application/json' },
        payload: {},
      })
      assert.equal(
        probe.calls(),
        1,
        'the counting authenticator did not run for a SECURED operation either, so §2b\'s zero ' +
          'is an instrument fault rather than a property',
      )
    } finally {
      await app.close()
    }
  })

  /**
   * ⚠️ THIS TITLE READ *"exactly one caller — the session reader"* UNTIL
   * 1 Oct 2026, AND THE NUMBER MOVED IN THE COMMIT THAT ADDED A SITE, AS ITS
   * OWN MESSAGE ASKED. S6 (G2490/G2493): `completeFederatedSignIn` resolves the
   * host it ARRIVED at, because that host is where it mints and where it
   * redirects. **§2b's reduction is unchanged by it**: the apex proxies
   * `/session/realm` and NOTHING ELSE (`MARKETING_PROXIED_PLANE_PATHS`, G1966 —
   * a 200 rewrite of a session-minting path would bind the cookie to the apex),
   * so no public-plane request can reach the second site.
   */
  it('2d · and `resolveServedHost()` has exactly three callers — the session reader and the two sign-in halves', () => {
    /**
     * §2b is a measurement of ONE request. This is the statement that it
     * generalises: if a second call site appeared — a hook, a handler, a
     * plug-in — the reduction *"reached the lookup"* ⇒ *"authenticate ran"*
     * would stop holding and §2b would be measuring a narrower thing than it
     * says.
     */
    const sites: string[] = []
    for (const file of sourceFilesUnder(SERVER_DIR)) {
      const source = codeOf(readFileSync(file, 'utf8'))
      for (const line of source.split('\n')) {
        if (/\bresolveServedHost\s*\(/.test(line)) {
          sites.push(`${path.relative(REPO_ROOT, file)}: ${line.trim()}`)
        }
      }
    }
    /* THREE since 1 Oct 2026: `signin-begin.ts` (G2541) builds the broker's
     * `redirect_uri` from the host it resolves, exactly as the callback mints
     * on it. Moved in the commit that added the site, as the message asks.
     * Neither sign-in half is reachable from the apex: the marketing plane
     * proxies `/session/realm` and no other path (§2a2). */
    assert.equal(
      sites.length,
      3,
      `\`resolveServedHost()\` is called from ${String(sites.length)} place(s) in \`server/\`:\n` +
        `${sites.join('\n')}\n\n` +
        'One is the whole of §2\'s reduction. A second site is not forbidden — it is a thing ' +
        'that changes what §2b proves, so move this number in the commit that adds one.',
    )
    assert.deepEqual(
      sites.map((s) => s.split(':')[0]).sort(),
      ['server/data-plane/federated-signin.ts', 'server/data-plane/session.ts', 'server/data-plane/signin-begin.ts'],
    )
  })

  it('2e · and the EDGE publishes `/session` and `/session/*` AS TWO PATTERNS — G1011', () => {
    /**
     * 🛑 **THIS ASSERTION IMPORTS THE EDGE'S OWN CONSTANT BECAUSE THE PROSE
     * ABOVE IT RESTED ON A SPELLING — G2022.** The header used to say a
     * rewrite *"carries `/session/*` on to the CONSOLE distribution"*, and
     * `/session/*` is a CloudFront pattern that **does not match `/session`**:
     * G1011 found exactly that on the deployed distribution and added
     * `/session` as a SECOND pattern, with `POST /context/resolve` answering
     * **403 from CloudFront for the whole life of that stack** as the
     * recorded red.
     *
     * **So the incomplete spelling green's reach argument was written around
     * is the spelling G1011 repaired**, and the two operations §2a2 names —
     * `getSession` and `signOut`, both at the bare `/session` — are precisely
     * the ones a single `/session/*` pattern would have left on the bundle.
     * This pins the join rather than describing it.
     */
    assert.ok(
      EDGE_PLANE_PATH_PATTERNS.some((pattern) => edgePatternMatches(pattern, PUBLIC_PATH)),
      `no edge pattern reaches \`${PUBLIC_PATH}\`, so the operation §2 measures is not ` +
        'published to a plane at all and §2b is about a request that could not arrive',
    )
    assert.ok(
      EDGE_PLANE_PATH_PATTERNS.some((pattern) => edgePatternMatches(pattern, '/session')),
      'no edge pattern reaches the bare `/session`, which is where `getSession` and `signOut` ' +
        'live. That is G1011 regressing: CloudFront\'s `/session/*` does not match `/session`, ' +
        'exactly as `/v1/*` does not match `/v1`, so a single prefix pattern leaves both on ' +
        'the BUNDLE and the SPA rewrite answers them with `index.html`.',
    )
    assert.ok(
      EDGE_PLANE_PATH_PATTERNS.length >= 2,
      'the plane path patterns collapsed to one entry; see `EDGE_PLANE_PATH_PATTERNS` for why ' +
        'there are four',
    )
  })
})

/* ==================================================================== *
 * §3 · A THIRD MEMBER WOULD BE INERT, AND WORSE THAN INERT.
 * ==================================================================== */

describe('§3 · a third member is ANSWERED — the guard, and what it answers with', () => {
  /**
   * ⚠️ **THIS BLOCK WAS HEADED *"nothing would be asked to answer a third
   * member"* AND ITS TWO ASSERTIONS WERE ABSENCES. Both are inverted by
   * G2021** — the guard was taken — **and the old text is quoted inside each
   * rather than deleted, because G1922 and G1923 are written on top of it.**
   *
   * 🛑 **§3a KEYED ON ONE SPELLING AND FIVE BYPASSES WALKED THROUGH IT AT
   * 15 OF 15 — G2022.** Its regex was `/Record<\s*ServedSurfaceKind/`, which
   * is a LANDMARK; the property is *does anything enumerate this union
   * exhaustively*. Measured, each added to `server/data-plane/session.ts` and
   * each leaving the suite green:
   *
   *   `Record<ServedSurface['kind'], number>`   the repository's own dominant
   *                                             idiom, via an indexed access
   *   `{ [K in ServedSurfaceKind]: number }`    the other standard totality
   *                                             form
   *   `switch (kind) { … default: never }`      **the repair §3b's own message
   *                                             called "the repair this
   *                                             assertion exists to notice"**
   *
   * The third is the one to read: the old §3b keyed its switch detection on
   * the word `surface` appearing inside the switch HEAD, so binding
   * `const kind = served.surface.kind` first defeated it completely.
   *
   * ⚠️ **AND THE POLARITY IS INVERTED WITH THE RE-KEY.** The old §3a asserted
   * that NO total form existed. Under G2021 that would be asserting the
   * ABSENCE OF A CONTROL: any of these three provides the protection, so the
   * assertion is that at least one is PRESENT in each reader.
   */
  const TOTAL_FORMS: ReadonlyArray<readonly [string, RegExp]> = [
    ['an exhaustive `switch` with a `never` default', /:\s*never\s*=/],
    [
      "a total `Record` over the kind (`ServedSurfaceKind` or `ServedSurface['kind']`)",
      /Record<\s*(?:ServedSurfaceKind|ServedSurface\s*\[\s*['"]kind['"]\s*\])/,
    ],
    [
      'a mapped type over the kind',
      /\[\s*\w+\s+in\s+(?:ServedSurfaceKind|ServedSurface\s*\[\s*['"]kind['"]\s*\])\s*\]/,
    ],
  ]

  /**
   * THE COMPLETE POPULATION OF READERS — `model/access.ts`'s `resolveSubject()`
   * and `server/data-plane/session.ts`'s `surfaceOf()`.
   *
   * ⚠️ THE TWO GUARD DIFFERENT AXES AND THE PAIR IS THE POINT:
   * `resolveSubject()` switches on `ServedSurfaceKind`, so a third CONST
   * MEMBER is the error; `surfaceOf()` switches on a `ServedSurface` VALUE, so
   * a third UNION ARM is — which is exactly the two things §1a and §1b assert
   * separately, held in the compiler instead of in a scanner.
   */
  const SURFACE_READERS: ReadonlyArray<readonly [string, string]> = [
    [path.join(MODEL_DIR, 'access.ts'), 'resolveSubject'],
    [path.join(SERVER_DIR, 'data-plane', 'session.ts'), 'surfaceOf'],
  ]

  /**
   * THE NAMED FUNCTION'S OWN BODY, COMMENTS STRIPPED.
   *
   * 🛑 **SCOPED TO THE FUNCTION AND NOT TO THE FILE, WHICH IS THE SAME REPAIR
   * THIS SECTION IS ABOUT, APPLIED TO ITSELF.** A first draft of §3a and §3a2
   * searched the whole of `model/access.ts` — six thousand lines — for a
   * `never` binding, so **a commit that deleted `resolveSubject()`'s guard
   * while leaving any other `never` in that file would have passed.** That is
   * a rule keyed on a convenient landmark (the FILE) instead of the property
   * (the READER), which is `docs/HANDOFF.md` §5.1 arriving inside the
   * assertion written to repair a §5.1.
   *
   * ⚠️ IT IS A SCANNER AND NOT A PARSER, AND THE LIMIT IS THE SAME ONE
   * `codeOf()` STATES: the body ends at the first `}` in the first column,
   * which is this repository's formatting and not a language rule. An empty
   * result is a RED at the call site rather than an absence.
   */
  function bodyOf(file: string, fn: string): string {
    const code = codeOf(readFileSync(file, 'utf8'))
    const pattern = new RegExp(`(?:export )?function ${fn}\\([\\s\\S]*?\\n\\}`)
    return pattern.exec(code)?.[0] ?? ''
  }

  it('3a · BOTH readers enumerate the surface union by a recognised TOTAL FORM', () => {
    /**
     * ⚠️ **THE ORIGINAL ASSERTION, QUOTED: *"there is no total `Record` over
     * `ServedSurfaceKind` anywhere"*, with the message *"A TOTAL `Record` OVER
     * `ServedSurfaceKind` NOW EXISTS … WHICH IS GOOD NEWS AND MAKES THIS
     * ASSERTION WRONG RATHER THAN BROKEN."* It was right about the tree and
     * right about what the repair would do to it. G2021 is that repair.**
     */
    const files = [...sourceFilesUnder(MODEL_DIR), ...sourceFilesUnder(SERVER_DIR)]
    /* §5.6 — the anti-vacuity guard the original §3a did NOT have, and whose
     * absence meant a broken regex was indistinguishable from a clean tree.
     * `tests/http/token-verify.test.ts` §4c is the precedent this file cited
     * and did not follow. */
    assert.ok(
      files.length > 20,
      `only ${String(files.length)} source file(s) were walked; every finding below would be ` +
        'free over an empty population',
    )

    for (const [file, why] of SURFACE_READERS) {
      assert.ok(
        files.includes(file),
        `${path.relative(REPO_ROOT, file)} was not reached by the walk, so the assertion about ` +
          `${why} is vacuous`,
      )
      const body = bodyOf(file, why)
      assert.notEqual(
        body,
        '',
        `\`${why}()\` could not be located in ${path.relative(REPO_ROOT, file)}, so every ` +
          'assertion below it would read an empty string and pass. See `bodyOf()`.',
      )
      assert.ok(
        /SERVED_SURFACE_KINDS\./.test(body),
        `${path.relative(REPO_ROOT, file)} no longer narrows on the surface at all (${why})`,
      )
      const found = TOTAL_FORMS.filter(([, pattern]) => pattern.test(body)).map(([name]) => name)
      assert.notEqual(
        found.length,
        0,
        `${path.relative(REPO_ROOT, file)} (${why}) no longer enumerates the surface union by ` +
          'any recognised total form. THAT IS G2021 BEING UNDONE: without one, a third member ' +
          'raises ZERO compile errors (G1922, measured — both typechecks EXIT 0) and is ' +
          'resolved AS A TENANT (G1923, measured — a subject carrying a tenantId no host ' +
          'named). The forms recognised here are:\n  ' +
          TOTAL_FORMS.map(([name]) => name).join('\n  ') +
          '\nA FOURTH form is not forbidden — it is a thing this list has to learn, and ' +
          'teaching it is part of the change that introduces it.',
      )
    }
  })

  it("3a2 · and the guard is keyed on the PROPERTY, never on the discriminant's name", () => {
    /**
     * 🛑 **THE BYPASS THAT MOTIVATED THE RE-KEY, PINNED SO IT CANNOT COME
     * BACK.** The old §3b refused a switch by matching
     * `/switch\s*\([^)]*surface[^)]*\)/` — the word `surface` inside the
     * switch head — and its own message called an exhaustive switch with a
     * `never` default *"the repair this assertion exists to notice"*. **It did
     * not notice it: binding `const kind = served.surface.kind` and switching
     * on `kind` left the suite at 15 of 15 with the repair fully in place.**
     *
     * What this keys on instead is the `never` BINDING, which is what makes a
     * switch exhaustive rather than merely present — a `switch` with no
     * `never` default is a chain of `if`s with different punctuation, and a
     * third member falls through it exactly as G1923 measured.
     */
    for (const [file, why] of SURFACE_READERS) {
      const body = bodyOf(file, why)
      assert.notEqual(body, '', `\`${why}()\` could not be located; see \`bodyOf()\``)
      assert.ok(
        /switch\s*\(/.test(body),
        `${path.relative(REPO_ROOT, file)} (${why}) has no \`switch\` at all. A total ` +
          '`Record` satisfies §3a instead, and that is a fine answer — but then THIS ' +
          'assertion is the one to re-read, because it is about the switch form in particular.',
      )
      assert.match(
        body,
        /:\s*never\s*=/,
        `${path.relative(REPO_ROOT, file)} (${why}) has a \`switch\` and no \`never\` binding. ` +
          'An exhaustive switch without one is not exhaustive: a third member falls to ' +
          '`default` or falls through, which is G1923 with more punctuation. ⚠️ THIS READS THE ' +
          'FUNCTION BODY AND NOT THE FILE — a `never` elsewhere in the same file does not ' +
          'satisfy it, which is the whole point of the scoping.',
      )
    }
  })

  it('3b · THE GUARD BITES — an undeclared surface is REFUSED, not laundered', () => {
    /**
     * 🛑 **THIS IS G1923's MEASUREMENT WITH ITS SIGN REVERSED, AND THE OLD
     * VALUE IS QUOTED SO THE CHANGE IS READABLE RATHER THAN INFERRED.**
     *
     * The original assertion demanded `laundered.ok === true` and then
     * demanded the subject carry `acmeScopedSession.tenantId`, with the
     * message: *"THIS IS THE FINDING IN ONE VALUE: a surface nobody declared
     * came back holding the session's tenant. A `public` member added without
     * a reader is not inert — it is laundered into a tenant scope by the
     * function that was supposed to refuse it."* **It was correct, and the
     * repair it named in its own text — *"If a `default: never` or an
     * exhaustive switch now guards it, §1a's third bullet is out of date"* —
     * is G2021. §1a's third bullet is rewritten.**
     *
     * ⚠️ THE CAST IS THE POINT AND NOT A SHORTCUT. It stands in for the member
     * a future commit would ADD. **With the guard in place that commit does
     * not GET this far — it gets a `TS2322` — so this assertion is about the
     * runtime fall-back a cast reaches, which is the only way the arm is
     * reachable at all.**
     */
    const unknown = 'public' as unknown as ServedSurfaceKind
    assert.notEqual(
      unknown,
      SERVED_SURFACE_KINDS.tenant,
      'the probe value collides with a real member and proves nothing',
    )
    assert.notEqual(unknown, SERVED_SURFACE_KINDS.console)

    const resolved = resolveSubject({
      session: acmeScopedSession,
      user: {
        id: acmeScopedSession.userId,
        email: 'mei@acme.example',
        displayName: 'Mei Tan',
        status: 'active',
        connectionId: acmeEntraConnection.id,
      },
      connection: acmeEntraConnection,
      now: '2026-08-22T09:10:00Z' as Timestamp,
      surface: unknown,
    })
    assert.equal(
      resolved.ok,
      false,
      'AN UNDECLARED SURFACE RESOLVED. That is G1923 returning: before G2021 this exact call ' +
        'answered {"ok":true,"subject":{"surface":"tenant","userId":"usr_ops_mei",' +
        '"tenantId":"ten_acme","orgClass":"customer","partnerId":null}} — the function REWROTE ' +
        'the surface and handed back a tenant scope. The repair is the `never` default in ' +
        '`resolveSubject()`, and §3a is what watches for its removal.',
    )
    assert.equal(
      resolved.ok === false ? resolved.refusal : '',
      SESSION_REFUSALS.surfaceUnreadable,
      'an undeclared surface was refused under some OTHER name, which reports a specific and ' +
        'untrue thing about the session. `db/migrations/0069`: an unknown value must reach the ' +
        'model as an `*_unreadable` refusal.',
    )
  })

  it('3c · no contract document declares a server at the apex', () => {
    const dir = path.join(REPO_ROOT, 'docs', 'contracts')
    const docs = readdirSync(dir).filter((f) => f.endsWith('.openapi.yaml'))
    assert.ok(docs.length >= 7, `only ${String(docs.length)} contract document(s) were read`)
    /**
     * §5.6 — THE POPULATION FLOOR, ADDED UNDER G2022. The document count alone
     * does not make this assertion mean anything: the loop below only fires on
     * a line matching `- url:`, so a corpus that declared NO servers — or a
     * regex that stopped matching the ones it does — would pass exactly as a
     * clean tree does. **The seven documents declare servers; requiring the
     * SEEN count to be non-zero is what separates "no apex server" from "no
     * server was looked at".**
     */
    let seen = 0
    for (const file of docs) {
      const text = readFileSync(path.join(dir, file), 'utf8')
      for (const line of text.split('\n')) {
        const url = /^\s*-\s*url:\s*(\S+)/.exec(line)?.[1]
        if (url === undefined) continue
        seen += 1
        assert.ok(
          !new RegExp(`https?://${APEX.replace('.', '\\.')}(/|$)`).test(url),
          `${file} declares a server at the apex (${url}). The marketing plane is Amplify's ` +
            '(G298) and serves no contract tier; a tier at the apex is the premise a third ' +
            'served surface would need, and it is a ruling.',
        )
      }
    }
    assert.ok(
      seen > 0,
      'ZERO `- url:` lines were examined across ' +
        `${String(docs.length)} contract document(s), so the assertion above fired on nothing ` +
        'and would have passed over a corpus that declared a server at the apex on every ' +
        'tier. Either the `servers` block moved or the matcher stopped matching it.',
    )
  })

  it('3d · and the frontend route layer models neither public-plane path', () => {
    /**
     * `/lookup` and `/demo` are the pack's two PUBLIC-plane rows, both
     * `exists: 'specified'`. `tests/app/route-provenance.test.ts` already
     * carries an argued entry for each; this asserts the consequence that
     * matters here — the application shell the planes serve holds no route
     * for either, so there is no client-side reader for a public surface.
     */
    const table = readFileSync(path.join(REPO_ROOT, 'frontend', 'src', 'routes', 'table.ts'), 'utf8')
    const paths = /export const ROUTE_PATHS = \[([\s\S]*?)\] as const/.exec(table)?.[1] ?? ''
    assert.notEqual(paths, '', '`ROUTE_PATHS` could not be located')

    /**
     * 🛑 **RE-KEYED FROM THE PATH'S PRESENCE ONTO WHAT THE SHELL DOES WITH
     * IT — G2032, 22 Sep 2026, AND THE OLD FORM IS QUOTED BECAUSE IT WAS
     * RIGHT ABOUT ITS OWN TREE AND WRONG ABOUT THIS ONE.** It read, for each
     * of `/lookup` and `/demo`: *"the route table now holds `<path>`. The
     * public plane is Amplify's and this table is the DATA plane's; a public
     * route here is a second answer to who owns the marketing surface, and it
     * is a ruling rather than a route."*
     *
     * 🛑 **THE RULING WAS TAKEN AND IT WENT THE OTHER WAY.** G1911 put both
     * paths in the closed set, from the pack's OWN route table, each tagged
     * `tier: 'Public'` and cited to a pack RECORD (`V2 Book a Demo.dc.html`,
     * `V3 Sign In.dc.html`) rather than to a drawn file that never existed.
     * So the table names them and claims nothing about serving them.
     *
     * ⚠️ **AND THE OLD ASSERTION WAS §5.1 — A RULE KEYED ON A CONVENIENT
     * LANDMARK INSTEAD OF THE PROPERTY IT PROTECTS**, which is the defect
     * this suite's own §3a was re-keyed for one section up (G2026). The
     * landmark was *the string appears in `ROUTE_PATHS`*; the property this
     * section is named for is *the public plane is not a SERVED SURFACE of
     * the data plane*. **A path the shell can NAME is not a path the shell
     * SERVES**, and the difference is a screen and a handler.
     *
     * **So this now asserts the property directly, and it is strictly
     * stronger than the absence it replaces:** for each public-plane path,
     * (a) if the table names it, its tier must be `Public` — not `Entry`, not
     * `Tier 1 · Work`; (b) `main.tsx` must wire NO screen for it, because a
     * screen is the client-side reader whose absence this section is about;
     * and (c) no contract document may declare an operation at that path.
     */
    const shell = readFileSync(path.join(REPO_ROOT, 'frontend', 'src', 'main.tsx'), 'utf8')
    for (const publicPath of ['/lookup', '/demo'] as const) {
      const named = new RegExp(`'${publicPath}'`).test(paths)
      if (named) {
        const entry = new RegExp(
          `'${publicPath}':\\s*\\{[^}]*?plane:\\s*'([^']+)'`,
          's',
        ).exec(table)
        assert.notEqual(
          entry,
          null,
          `\`${publicPath}\` is in \`ROUTE_PATHS\` and its \`ROUTES\` entry states no ` +
            '`plane`. This section is about which PLANE owns the surface, so an entry that ' +
            'does not say answers nothing — and G1918 took `plane` as a FIELD precisely so ' +
            'that it would have to.',
        )
        assert.equal(
          entry?.[1],
          'public',
          `\`${publicPath}\` is tagged \`plane: '${String(entry?.[1])}'\` and not \`'public'\`. ` +
            "The public plane is Amplify's; a public path tagged as a data-plane one is the " +
            'second answer to who owns the marketing surface that the old form of this ' +
            'assertion refused outright, arriving through the plane instead of the path.',
        )
      }
      /**
       * 🛑 **RE-KEYED A THIRD TIME, AND BACK TOWARD ITS ORIGINAL INTENT — G3158,
       * 2 Oct 2026, UNDER THE OWNER'S RULING THAT ANSWERS G3078:** *"Apex only:
       * serve /demo and /lookup from the apex marketing site (Amplify);
       * tenant/console hosts redirect there."*
       *
       * The two forms it replaces are quoted, because each fired exactly as
       * designed. G2032's asserted that `main.tsx` wires NO screen for either
       * path — *"rendering one is this application serving the marketing
       * surface, which is Amplify's."* G3078's narrowed that to "no screen
       * INSIDE `ShellApp`, and nothing under `frontend/src/public/` imports a
       * `/v1` client", because a sibling slice had built both screens into this
       * bundle and whether it might was put back to the owner. **The owner ruled
       * the first form right**, so this asserts it again and adds what the
       * ruling adds — the application REDIRECTS:
       *
       *   (b1) `main.tsx` wires no screen for the path, anywhere in the file;
       *   (b2) the bundle holds no public screen at all — `frontend/src/public/`
       *        does not exist, and `main.tsx` imports nothing from the apex
       *        site's tree (`frontend/site/`);
       *   (b3) `routes/apex.ts` maps the path to the apex, on `APEX_HOST`.
       */
      assert.ok(
        !new RegExp(`'${publicPath}':\\s*\\(`).test(shell),
        `\`main.tsx\` wires a SCREEN for \`${publicPath}\`. The owner's ruling of 2 Oct 2026 puts ` +
          'the public plane on the APEX and has tenant and console hosts REDIRECT there; a screen ' +
          'here is this application serving the marketing surface, which is Amplify\'s.',
      )
      assert.equal(apexUrlFor(publicPath), `https://${APEX_HOST}${publicPath}/`, `\`${publicPath}\` does not redirect to the apex`)
    }
    assert.equal(
      existsSync(path.join(REPO_ROOT, 'frontend', 'src', 'public')),
      false,
      '`frontend/src/public/` exists again: the application bundle holds a public screen. Under the ' +
        "owner's ruling the public plane is the apex site's (`frontend/site/`), and this bundle redirects.",
    )
    assert.doesNotMatch(
      shell,
      /from '\.\.?\/(?:\.\.\/)*site\//,
      '`main.tsx` imports from the apex site — the two bundles must not share a page.',
    )
    assert.deepEqual(Object.keys(APEX_PAGES).sort(), ['/demo', '/lookup'])
    assert.match(shell, /isApexPath\(route\.path\)/, '`App` no longer routes the public paths to the apex redirect')
  })
})

/* ==================================================================== *
 * §4 · WHAT `Host` WOULD REACH A PLANE, IF S7 GIVES THE CONSOLE
 *      DISTRIBUTION A PLANE ORIGIN.
 * ==================================================================== */

describe('§4 · the apex never reaches a plane, and an apex `Host` fails closed anyway', () => {
  /**
   * 🛑 **§4a RESOLVES EVERY `domainNames` ENTRY TO A VALUE SINCE G2022, AND
   * THE OLD FORM WAS DEFEATED BY ONE LEVEL OF INDIRECTION.** It compared each
   * entry against the IDENTIFIER `'ROOT_DOMAIN'` and the LITERAL
   * `'reconcileai.app'`, so `const APEX_ALIAS = ROOT_DOMAIN` followed by
   * `domainNames: [EDGE_TENANT_WILDCARD_DOMAIN, APEX_ALIAS]` **passed, at 15
   * of 15, with the apex on the TENANT distribution's aliases** — the exact
   * fail-open G298 refused and G180 makes permanent.
   *
   * ⚠️ **AND IT PASSED ONLY ON THE TENANT DISTRIBUTION, WHICH IS WORTH
   * RECORDING BECAUSE IT IS NARROWER THAN THE BYPASS SOUNDS:** the same alias
   * on the CONSOLE distribution fired §4b, whose regex pins
   * `[CONSOLE_HOST, PARTNERS_HOST]` exactly. **So one of the two
   * distributions was covered and one was not**, which is the shape a reader
   * cannot see from a green run.
   *
   * The repair is to RESOLVE: `infra/lib/config.ts` is importable from the
   * root (it has no imports, by ruling), so each entry is looked up as an
   * exported value or as a local `const` alias of one, and **an entry that
   * cannot be resolved is a RED rather than a pass** — §5.1's repair applied
   * to the scanner that had §5.1's shape.
   */

  /** Every exported string constant of the edge config, by identifier. */
  const EDGE_VALUES: ReadonlyMap<string, string> = new Map(
    Object.entries(edgeConfig).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )

  /**
   * Resolve one `domainNames` entry to the host it names.
   *
   * Handles the three spellings that can appear: a string literal, an
   * exported identifier, and a LOCAL `const X = <exported identifier>` alias
   * declared inside `edge-stack.ts` — which is the bypass. `undefined` means
   * *this scanner does not understand the entry*, and the caller treats that
   * as a failure rather than as an absence.
   */
  function resolveEntry(entry: string, source: string): string | undefined {
    const literal = /^['"`]([^'"`]*)['"`]$/.exec(entry)?.[1]
    if (literal !== undefined) return literal
    const direct = EDGE_VALUES.get(entry)
    if (direct !== undefined) return direct
    const alias = new RegExp(`\\bconst\\s+${entry}\\s*(?::[^=]+)?=\\s*([^\\n;]+)`).exec(source)?.[1]
    if (alias === undefined) return undefined
    const trimmed = alias.trim().replace(/,$/, '')
    if (trimmed === entry) return undefined
    return resolveEntry(trimmed, source)
  }

  it('4a · the apex is on neither certificate and, BY VALUE, on neither distribution', () => {
    const config = codeOf(readFileSync(path.join(REPO_ROOT, 'infra', 'lib', 'config.ts'), 'utf8'))
    assert.ok(
      /EDGE_APEX_IS_SERVED_ELSEWHERE\s*=\s*true/.test(config),
      '`EDGE_APEX_IS_SERVED_ELSEWHERE` is no longer `true`. G298 confirmed the NARROW reading ' +
        "of G297 — the apex is Amplify's — and every sentence in this file rests on it.",
    )
    /* The apex is the VALUE of `ROOT_DOMAIN`, read from the module rather than
     * typed here — which is what makes this assertion value-keyed at both
     * ends. `APEX` is checked against it so the constant at the top of this
     * file cannot drift away from the thing it names. */
    const apex = EDGE_VALUES.get('ROOT_DOMAIN')
    assert.equal(
      apex,
      APEX,
      `\`ROOT_DOMAIN\` is ${String(apex)} and this file calls the apex \`${APEX}\`. Everything ` +
        'below compares resolved values against the former.',
    )

    const edge = codeOf(readFileSync(path.join(REPO_ROOT, 'infra', 'lib', 'edge-stack.ts'), 'utf8'))
    const declarations = [...edge.matchAll(/domainNames:\s*\[([^\]]*)\]/g)].map((m) => m[1] ?? '')
    assert.ok(declarations.length >= 2, 'fewer than two distributions declare `domainNames`')

    let entries = 0
    for (const names of declarations) {
      for (const entry of names.split(',').map((x) => x.trim()).filter((x) => x !== '')) {
        entries += 1
        const value = resolveEntry(entry, edge)
        /**
         * 🛑 AN UNRESOLVABLE ENTRY IS A RED AND NOT A PASS, AND THAT IS THE
         * WHOLE REPAIR. The previous form asked *"is this entry spelled like
         * the apex"* and answered NO for every spelling it did not know; this
         * asks *"what host is this"* and refuses to guess. A fourth spelling
         * — a template literal with two substitutions, a helper call, an
         * imported alias — lands HERE, loudly, in the commit that writes it.
         */
        assert.notEqual(
          value,
          undefined,
          `a \`domainNames\` entry could not be resolved to a host: \`${entry}\` in ` +
            `[${names.trim()}]. This assertion refuses to guess, because the spelling it ` +
            'could not read is exactly where a silent apex alias hid before (G2022). Teach ' +
            '`resolveEntry()` the form, in the commit that introduces it.',
        )
        assert.notEqual(
          value,
          apex,
          `a CloudFront distribution claims the apex: \`${entry}\` resolves to \`${String(value)}\` ` +
            `in domainNames: [${names.trim()}]. G298's rejected alternative was exactly this, ` +
            "and its cost is under G180: two stacks claiming one permanent, additive binding. " +
            'NOTE the spelling is irrelevant — this compares the resolved VALUE, because ' +
            '`const APEX_ALIAS = ROOT_DOMAIN` walked through the identifier-keyed form.',
        )
      }
    }
    assert.ok(
      entries >= 3,
      `only ${String(entries)} \`domainNames\` entr(y/ies) were examined across ` +
        `${String(declarations.length)} declaration(s). The tree declares one wildcard on the ` +
        'tenant distribution and two named hosts on the console one; a lower number means the ' +
        'bracket matcher is reading less than it thinks.',
    )
  })

  it('4b · the console distribution answers for two names — and it has NO plane origin', () => {
    /**
     * 🛑 **THIS IS WHY THE REWRITE NEEDS NO NEW KIND.** An Amplify rewrite is
     * a server-side PROXY: the browser's `Host: reconcileai.app` terminates at
     * Amplify, and the name presented onward is the rewrite's target. That
     * target is a name the console distribution answers for, and
     * `resolveConsoleHost()` has resolved console hosts since G726.
     *
     * ⚠️ **AND THE `ALL_VIEWER` SENTENCE THAT STOOD HERE WAS WRONG ABOUT THE
     * DISTRIBUTION IT NAMED — G2024. IT IS CORRECTED RATHER THAN DELETED,
     * because G1924's row was written from it.** It read: *"CloudFront's
     * `ALL_VIEWER` origin-request policy then forwards THAT `Host` to the
     * plane, which is the mechanism `edge-stack.ts` calls 'the whole mechanism
     * of G179 at this layer'."*
     *
     * **`ALL_VIEWER` is on the TENANT distribution's PLANE behaviours and
     * nowhere else.** `planeBehaviours` in `infra/lib/edge-stack.ts` spreads
     * it across `EDGE_PLANE_PATH_PATTERNS` into that distribution's
     * `additionalBehaviors`; **the console distribution has ONE origin — the
     * S3 bundle — `ALLOW_GET_HEAD`, `CACHING_OPTIMIZED`, NO
     * `originRequestPolicy` and no `additionalBehaviors` at all**, and its own
     * `comment` ends *"no plane origin"*. This assertion measures that rather
     * than restating it.
     *
     * 🛑 **SO A PROXIED `POST /session/realm` REACHES NO PLANE TODAY, AND THE
     * ANSWER IT GETS IS `403` — G2025, SETTLED AGAINST TWO WRONG FIGURES
     * ALREADY IN CIRCULATION.** A method outside a behaviour's
     * `AllowedMethods` is refused BY CLOUDFRONT with `403 MethodNotAllowed`;
     * the request never reaches S3 and the viewer-request function never
     * runs. **The in-tree measurement is `infra/lib/edge-stack.ts`'s own:
     * *"`POST /context/resolve` answered 403 from CloudFront for the whole
     * life of this stack"*, which is a POST falling to that same
     * `ALLOW_GET_HEAD` default behaviour** — repeated at
     * `tests/infra/edge.test.mjs` §2's header and at
     * `tests/e2e/single-origin.ts`.
     *
     *   · **404 from S3 is wrong twice over.** For a POST the request is
     *     refused at the edge and S3 is never asked; and even a GET would be
     *     rewritten to `/index.html` by the SPA function (a final segment
     *     with no dot) and answered **200**, not 404.
     *   · **405 is wrong too.** It appears in this repository only as prose —
     *     `edge-stack.ts`'s *"`ALLOW_GET_HEAD` here would answer a mounted
     *     write with a 405"* and `tests/infra/edge.test.mjs`'s assertion
     *     message — and both are corrected in this commit. Neither was ever
     *     measured; the 403 was.
     */
    const config = readFileSync(path.join(REPO_ROOT, 'infra', 'lib', 'config.ts'), 'utf8')
    const consoleHost = /export const CONSOLE_HOST = `\$\{CONSOLE_HOST_LABEL\}\.\$\{ROOT_DOMAIN\}`/
    assert.ok(
      consoleHost.test(config),
      '`CONSOLE_HOST` is no longer `console.<root>`; §4b is about which name a rewrite target ' +
        'presents, so its spelling is load-bearing here',
    )
    const edge = codeOf(readFileSync(path.join(REPO_ROOT, 'infra', 'lib', 'edge-stack.ts'), 'utf8'))
    assert.match(
      edge,
      /domainNames:\s*\[CONSOLE_HOST,\s*PARTNERS_HOST\]/,
      "the console distribution's `domainNames` have changed. A rewrite target that is not one " +
        'of those two is a name CloudFront will not serve, which is a deployment question ' +
        'rather than a model one — but it is the question §4b answers.',
    )

    /**
     * THE CORRECTED HALF, ASSERTED: the console distribution's construct body
     * carries no `originRequestPolicy`, no `additionalBehaviors` and the
     * GET/HEAD method set. Read from `new cloudfront.Distribution(this,
     * 'ConsoleDistribution'` to the end of its options object.
     */
    const consoleBody =
      /new cloudfront\.Distribution\(\s*this,\s*'ConsoleDistribution',\s*\{[\s\S]*?\n {4}\}\)/
        .exec(edge)?.[0] ?? ''
    assert.notEqual(consoleBody, '', 'the console distribution could not be located')
    /**
     * 🛑 **THE SIBLING SLICE LANDED AND THESE TWO ASSERTIONS ARE RE-KEYED FROM
     * AN ABSENCE ONTO THE SHAPE THAT REPLACED IT — G2033, 22 Sep 2026.** They
     * are quoted rather than deleted, because both were RIGHT about the tree
     * that carried them and the second names its own successor: *"the console
     * distribution now declares `additionalBehaviors`, which is where a plane
     * origin would live. **That is the sibling slice**, and it changes what a
     * proxied `/session/realm` reaches — today it reaches the BUNDLE behaviour
     * and is refused 403 by CloudFront because the method is not in
     * ALLOW_GET_HEAD."* The other read: *"the console distribution now sets an
     * `originRequestPolicy` … If it is true now, a plane origin arrived with
     * it and §4b, G1924 and G1926 all need re-reading together."*
     *
     * **It is true now, and they have been re-read together.** G1949/G1950
     * gave this distribution a plane origin, and the two forecasts were
     * exactly right about what it would change.
     *
     * 🛑 **SO THE SECTION'S TITLE IS NOW HALF FALSE AND THE HALF THAT SURVIVES
     * IS THE LOAD-BEARING ONE.** *"The apex never reaches a plane"* is ended
     * BY DESIGN. *"…and an apex `Host` fails closed anyway"* is untouched, is
     * `model/`'s rather than `infra/`'s, and is what §4c asserts: a request
     * arriving with `Host: reconcileai.app` is refused by
     * `resolveServedHost()` whatever CloudFront was willing to forward.
     * **The edge is now a door; the model is still the lock.**
     *
     * ⚠️ **AND THE OLD FORM WAS §5.1 — KEYED ON A LANDMARK (no
     * `additionalBehaviors` at all) RATHER THAN ON THE PROPERTY (the plane
     * origin is EXACTLY the set of paths the apex is allowed to proxy).** A
     * behaviour for `/session/*` would have passed the old assertion's
     * successor just as a behaviour for `/session/realm` does; what must be
     * true is that the two constants AGREE, and nothing asserted that until
     * now. This is the same repair §3a and §3d took in this file.
     */
    assert.match(
      consoleBody,
      /additionalBehaviors:\s*consolePlaneBehaviours/,
      'the console distribution no longer declares `additionalBehaviors`. G1949 gave it a ' +
        'plane origin for exactly the proxied path set; if that is gone, a proxied ' +
        '`/session/realm` falls to the BUNDLE behaviour again and is refused 403 by ' +
        'CloudFront, and §14/§15 of `docs/build/deploy-handoff.md` are wrong about what a ' +
        'deploy produces.',
    )

    /**
     * THE PROPERTY, ASSERTED IN BOTH DIRECTIONS: the paths the console
     * distribution gives a plane origin to are EXACTLY the paths the Amplify
     * apex is allowed to proxy. Two constants, two files, one set — stated
     * twice by two slices that never saw each other, and checked here rather
     * than left to agree by habit.
     */
    /**
     * ✅ G2770 — THE OWNER'S RULING, 2 Oct 2026, ROUTES THE CONSOLE'S FULL SIGN-IN
     * PATHS TO THE PLANE, SO THE TWO CONSTANTS ARE NO LONGER ONE SET. THE TWO
     * ASSERTIONS THAT STOOD HERE — *"exactly the paths the Amplify apex is
     * allowed to proxy"* and *"no console plane behaviour carries a WILDCARD"* —
     * ARE REPLACED, NOT DELETED, BY THE PROPERTY EACH WAS A STAND-IN FOR:
     *
     *   1. every path the APEX proxies lands on a console PLANE behaviour (an
     *      apex rewrite that fell to the bundle would answer with HTML);
     *   2. the APEX still proxies no session-bearing path — its own list is
     *      still exactly `/session/realm`, which `assertProxiesNoSessionBearingPath()`
     *      guards at synth. The console HOSTS may now mint a console session;
     *      the APEX may not, because a 200 rewrite would bind the cookie to
     *      `reconcileai.app`.
     */
    const consolePatterns: readonly string[] = [...edgeConfig.EDGE_CONSOLE_PLANE_PATH_PATTERNS]
    for (const proxied of edgeConfig.MARKETING_PROXIED_PLANE_PATHS) {
      assert.ok(
        consolePatterns.some((pattern) =>
          pattern.endsWith('*') ? proxied.startsWith(pattern.slice(0, -1)) : proxied === pattern,
        ),
        `the apex proxies ${proxied} and no console plane behaviour serves it — the bundle would answer`,
      )
    }
    assert.deepEqual(
      [...edgeConfig.MARKETING_PROXIED_PLANE_PATHS],
      ['/session/realm'],
      'the APEX now proxies a path other than /session/realm. A 200 rewrite of a session-bearing ' +
        "path binds `__Host-reconcile_session` to the apex, which G180 then revokes at the real host.",
    )
    assert.match(
      consoleBody,
      /allowedMethods:\s*cloudfront\.AllowedMethods\.ALLOW_GET_HEAD/,
      "the console distribution's default behaviour no longer refuses a POST, so the 403 in " +
        'this section is no longer the answer a proxied `/session/realm` would get',
    )
    /* And `ALL_VIEWER` IS present in the file — on the other distribution. A
     * bare absence here would read as "this repository forwards no Host at
     * all", which is the opposite mistake. */
    assert.match(
      edge,
      /originRequestPolicy:\s*cloudfront\.OriginRequestPolicy\.ALL_VIEWER/,
      '`ALL_VIEWER` has left `edge-stack.ts` entirely. It is G179 at the edge and belongs on ' +
        "the TENANT distribution's plane behaviours; its disappearance is a larger change " +
        'than this section is about.',
    )
  })

  it('4c · and an apex `Host` arriving anyway is REFUSED, then falls back to the stricter surface', () => {
    /**
     * The belt-and-braces half. If a future proxy DID preserve the apex — or
     * if somebody pointed a record at a plane directly — nothing here admits
     * it: `resolveServedHost()` refuses it as unregistered, and `surfaceOf()`
     * answers `tenant`, which its own header calls *"a fall-back to the
     * NARROWER of two answers, not a fall-back to a permission"*. On a tenant
     * surface an unbound session is refused at `tenant_not_selected`.
     *
     * 🛑 SO THE ABSENT THIRD MEMBER IS NOT A HOLE. The apex already has an
     * answer, it is the safe one, and it is the answer a `public` member would
     * have had to improve on rather than merely name.
     */
    const answer = resolveServedHost([], [], APEX)
    assert.equal(answer.ok, false)
    assert.equal(
      answer.ok === false ? answer.refusal : '',
      /**
       * ⚠️ **`SERVED_HOST_REFUSALS`, NOT `SERVING_HOST_REFUSALS` — G2026.**
       * `resolveServedHost()` returns a `ServedHostRefusal`, and
       * `SERVED_HOST_REFUSALS` is `{...SERVING_HOST_REFUSALS,
       * hostServesATenantAndAConsole}`. The two are EQUAL BY VALUE on this
       * member, so the old spelling passed — and it named a constant the
       * function does not answer from, which is the class of thing that goes
       * wrong when the spread is later narrowed.
       */
      SERVED_HOST_REFUSALS.hostNotRegistered,
      'the apex resolves to something other than `host_not_registered`. A registry that names ' +
        'it is a deployment decision nobody has taken.',
    )
    const surfaceOfSource = codeOf(
      readFileSync(path.join(SERVER_DIR, 'data-plane', 'session.ts'), 'utf8'),
    )
    const body = /function surfaceOf\([\s\S]*?\n}/.exec(surfaceOfSource)?.[0] ?? ''
    assert.notEqual(body, '', '`surfaceOf()` could not be located')
    assert.match(
      body,
      /return SERVED_SURFACE_KINDS\.tenant\s*$/m,
      'the unregistered-host fall-back is no longer the TENANT surface. That fall-back is what ' +
        'makes an apex `Host` fail closed; a fall-back to `console` would resolve an unbound ' +
        'session and hand it authority.',
    )
  })
})
