/**
 * THE SERVED SET, DERIVED — G2083.
 *
 * ┌─ WHY THIS SUITE EXISTS AND WHAT IT PINS ──────────────────────────────────┐
 * │ Four documents handed out a recursive grep for the handler key as the      │
 * │ derivation of *"N of 136 operations served"*, and it was wrong TWICE:      │
 * │                                                                            │
 * │   1 · it counted its own explanation — G2081's class, gated separately;    │
 * │   2 · it was never a derivation of that number at all. The handler key     │
 * │       occurs ONCE PER TIER MOUNT. Comment-stripped it answers SEVEN, and   │
 * │       seven is the number of tier mounts. **Nobody could reach 30 from     │
 * │       it**, which is why the figures in circulation — 23, 25, 26, 29 —     │
 * │       were counted by eye and no two documents agreed.                     │
 * │                                                                            │
 * │ §3 is the one to read. `checkLocalHealth` is mounted by ES6 SHORTHAND and  │
 * │ carries NO COLON, so a key-and-colon scan answers 29; the looser scan that │
 * │ appeared to answer 30 reached it by ALSO matching the TYPE ANNOTATION on   │
 * │ `const checkLocalHealth: Handler` — one false negative and one false       │
 * │ positive, in different places, summing to the right answer. Both were      │
 * │ wrong and their total looked right. That is the shape this suite pins.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { declaredOperations, mountedOperations } from '../../tools/served-set.mjs'
import { stripComments } from '../../tools/check-clock-fixtures.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('served-set', () => {
  test('§1 · the denominator is PARSED, and it agrees with check-doc-counts', () => {
    const declared = declaredOperations(REPO)
    assert.ok(declared.size > 0, 'a zero subject is a broken run, not an empty product')
    // The grep that used to derive this summed to 137 because one match was a
    // line of prose quoting it. The parser cannot be moved by any spelling.
    // ⚠️ 136 UNTIL 1 Oct 2026 — R13 declared `listRunAllocations` (G2374). A pin
    // moved deliberately in the commit that moved the denominator, §5.11.
    // ⚠️ THIS SAID 136 UNTIL 1 Oct 2026, AND 137 IS NOW THE PARSER'S ANSWER
    // TOO — G2401 DECLARED `bindEndpointCredential`. The same number the
    // prose grep used to reach by accident is reached here by a declaration,
    // which is the case this pin exists to tell apart: it moves when an
    // operation is DECLARED, and by nothing else.
    // 🛑 138 IS A THIRD ANSWER NEITHER PARENT COMPUTED — G2532, integrate/1oct-b.
    // R13 (#503) said 137 after `listRunAllocations`; C9 (#506) said 137 after
    // `bindEndpointCredential`. The number agreed and the sets did not, §5.11
    // with a second parent. Both narrations are kept above; this pin is the
    // value re-derived by the parser on the merged tree.
    // ⚠️ 138 UNTIL LATER ON 1 Oct 2026 — G2541 DECLARED `beginFederatedSignIn`
    // (the owner's begin-sign-in ruling) in the commit that mounts it. Moved
    // deliberately with the denominator, §5.11.
    // ⚠️ 138 UNTIL 1 Oct 2026 — G2681 DECLARED FIVE: `listEndpoints`,
    // `declareEndpoint`, `stopEndpoint`, `resumeEndpoint` and
    // `declareEndpointDocumentType`, every one also MOUNTED in the same commit.
    // Moved deliberately in the commit that moved the denominator, §5.11.
    // 🛑 144 IS A THIRD ANSWER NEITHER PARENT COMPUTED — G2743, integrate/1oct-c.
    // #513 said 139 (138 + `beginFederatedSignIn`); #515 said 143 (138 + C9's
    // five). Each was right about its own tree; 138 + 1 + 5 = 144, re-derived by
    // the parser on the merged tree (`node tools/served-set.mjs`). Both
    // narrations are kept above; this pin is the merged value.
    // ⚠️ 144 UNTIL 2 Oct 2026 — G2831–G2840 DECLARED THREE: `listParkedArrivals`,
    // `getParkedArrival` and `raiseParkedArrival`, every one also MOUNTED in the
    // same commit (G2692, the owner’s). Moved with the denominator, §5.11.
    // 🛑 145 — #520 merged onto 144: G2762 declared `relayBrokerReturn`
    // (the owner's G2549). 144 + 1, re-derived by the parser on the merged tree.
    // ⚠️ 139 UNTIL 2 Oct 2026 — G2549 (the owner's shared-callback ruling)
    // DECLARED `relayBrokerReturn` in the commit that mounts it (G2762). Moved
    // deliberately with the denominator, §5.11.
    // 🛑 148 IS A THIRD ANSWER NEITHER PARENT COMPUTED — G2931, integrate/2oct-d.
    // #518 said 147 (144 + the parked pile's three); #520 said 145 (144 +
    // `relayBrokerReturn`). 144 + 3 + 1 = 148, re-derived by the parser on the
    // merged tree (`node tools/served-set.mjs`). Both narrations are kept above.
    // ⚠️ 148 UNTIL 3 Oct 2026 — G3354 DECLARED `getSessionPrincipal` (the
    // chrome's who-am-I) in the commit that mounts it. Moved with the
    // denominator, §5.11.
    // ⚠️ 149 UNTIL 4 Oct 2026 — G3941 DECLARED `listDocumentTypes` (C3-15)
    // in the commit that mounts it. Moved with the denominator, §5.11.
    // ⚠️ 150 UNTIL 5 Oct 2026 — G4301 (the owner's "Full restore" ruling)
    // DECLARED the control plane's four internal operations in the commit that
    // mounts them. Moved with the denominator, §5.11.
    assert.equal(declared.size, 154)
  })

  test('§2 · the numerator is a SUBSET of the denominator, by construction', () => {
    const declared = declaredOperations(REPO)
    const mounted = mountedOperations(REPO, declared)
    for (const id of mounted)
      assert.ok(declared.has(id), `${id} is mounted and not declared — mountTier() refuses to boot on that`)
    assert.ok(mounted.size > 0 && mounted.size <= declared.size)
  })

  test('§3 · ES6 SHORTHAND IS READ — the mount that carries no colon', () => {
    const declared = declaredOperations(REPO)
    const mounted = mountedOperations(REPO, declared)
    assert.ok(
      mounted.has('checkLocalHealth'),
      'mounted as `handlers: { checkLocalHealth }` with no colon at all. A key-and-colon scan ' +
        'silently loses it and answers one short.',
    )

    // and the shorthand really is how it is written — if this ever fails the
    // mount was rewritten and §3 is testing nothing
    const src = stripComments(readFileSync(join(REPO, 'server/data-plane/start.ts'), 'utf8'))
    assert.match(src, /handlers:\s*\{\s*checkLocalHealth\s*\}/)
  })

  test('§3a · and a TYPE ANNOTATION is NOT a mount', () => {
    // The loose scan that appeared to answer 30 matched this line. It is a
    // local declaration, not a handler key, and counting it was a false
    // positive that happened to cancel the shorthand false negative.
    const src = readFileSync(join(REPO, 'server/data-plane/start.ts'), 'utf8')
    assert.match(src, /const checkLocalHealth: Handler/)

    const declared = declaredOperations(REPO)
    const stripped = stripComments(src)
    const loose = (id) => new RegExp('(^|[{,\\s])' + id + '\\s*:', 'm').test(stripped)
    const strict = (id) => new RegExp('(?:^|[{,])\\s*' + id + '\\s*(?::|[,}])', 'm').test(stripped)
    assert.equal(loose('checkLocalHealth'), true, 'the loose scan matches the annotation')
    assert.equal(strict('checkLocalHealth'), true, 'the shipped scan matches the shorthand mount')
    // the two agree HERE and disagreed on which fact they were reading; the
    // disagreement is visible on any id that is declared but never mounted
    const unmounted = [...declared.keys()].find((id) => !strict(id) && !loose(id))
    assert.ok(unmounted, 'the tree must still hold an unmounted operation or §2 is vacuous')
  })

  test('§4 · COMMENTS ARE STRIPPED, and the stripper is imported not copied', () => {
    // `server/` headers name operations constantly. A second implementation of
    // one rule is §5.3, and the one that drifts is always the copy.
    const declared = declaredOperations(REPO)
    const raw = ['server/control-plane/start.ts', 'server/data-plane/start.ts']
      .map((f) => readFileSync(join(REPO, f), 'utf8'))
      .join('\n')
    assert.notEqual(stripComments(raw), raw, 'these files carry comments, so stripping is observable')
    assert.ok(mountedOperations(REPO, declared).size > 0)
  })

  test('§5 · the handler key is once per TIER MOUNT and never once per operation', () => {
    // THE SECOND DEFECT, PINNED. This is why no reading of the retired command
    // could reach the served count, self-quotation or not.
    const stripped = ['server/control-plane/start.ts', 'server/data-plane/start.ts']
      .map((f) => stripComments(readFileSync(join(REPO, f), 'utf8')))
      .join('\n')
    const tierMounts = stripped.split('\n').filter((l) => /(^|[{,\s])handlers:/.test(l)).length
    const mounted = mountedOperations(REPO).size
    assert.ok(
      tierMounts < mounted,
      `the retired derivation answers ${tierMounts} (tier mounts) against ${mounted} operations served — ` +
        'the two are different facts and only the second was ever wanted',
    )
  })
})
