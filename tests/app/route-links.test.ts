/**
 * THE LINK LAYER — building a path, deciding whether a click is ours, and the
 * router's own behaviour under a fake host. G486, 19 Sep 2026.
 *
 * ┌─ WHY THIS SUITE EXISTS AT ALL ────────────────────────────────────────────┐
 * │ Wiring the route table into `main.tsx` added exactly two things the table  │
 * │ did not have: a way to WRITE a path (`hrefOf`) and a rule for when a click │
 * │ on one belongs to the router (`shouldIntercept`). Both are pure, both are  │
 * │ in `.ts` files with no JSX and no DOM types, and both are therefore        │
 * │ witnessable here with no browser and no build — which is the property      │
 * │ `frontend/src/routes/table.ts` took the `.ts`/`.tsx` split to preserve.    │
 * │                                                                            │
 * │ 🛑 AND `createRouter` WAS UNTESTED BY ANYTHING BEFORE THIS FILE. It has    │
 * │ carried a focus rule, a no-op rule and a `popstate` subscription since     │
 * │ #267 and nothing exercised any of them — `tests/app/route-table.test.ts`,  │
 * │ which its header cites five times, was RETIRED under G278. A router the    │
 * │ application now depends on cannot rest on a suite that does not exist.     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NO PATH IS TYPED INTO AN ASSERTION BELOW EXCEPT WHERE THE PATH IS THE
 * SUBJECT. §1 walks `ROUTE_PATHS` and derives each pattern's parameters with
 * `paramNamesOf`, so a thirteenth route — or a renamed parameter — is covered
 * the day it lands rather than the day somebody remembers this file.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ROUTE_PATHS,
  hrefOf,
  paramNamesOf,
  resolve,
  type BoundParams,
  type RoutePath,
} from '../../frontend/src/routes/table.ts'
import {
  createRouter,
  shouldIntercept,
  type NavigationClick,
  type RouterHost,
} from '../../frontend/src/routes/router.ts'

/**
 * A binding for every parameter a pattern declares.
 *
 * ⚠️ THE VALUES ARE DERIVED FROM THE NAMES so that a route gaining a second
 * parameter needs no edit here, and so that §1's round trip can tell WHICH
 * parameter came back wrong rather than only that one did.
 */
function bindingsFor(path: RoutePath, value: (name: string) => string): BoundParams {
  const out: Record<string, string> = {}
  for (const name of paramNamesOf(path)) out[name] = value(name)
  return out
}

/**
 * `hrefOf` is generic over `P extends RoutePath` and this suite iterates the
 * union, so the call site cannot name a literal. The widening is to the same
 * opaque-string record the matcher hands back — it does not launder a type,
 * it forgets WHICH member of a closed union is in hand, which is exactly what
 * iterating the union means.
 */
function href(path: RoutePath, bound: BoundParams): string {
  return hrefOf(path, bound as never)
}

/** Every field `shouldIntercept` reads, at its innocent value. */
function plainClick(over: Partial<NavigationClick> = {}): NavigationClick {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => undefined,
    ...over,
  }
}

// ──────────────────────────────────────────────────────────────────────────
describe('1 · every route the table declares can be WRITTEN and read back', () => {
  /**
   * 🛑 THE ROUND TRIP IS THE ASSERTION AND NOT THE STRING. Comparing `hrefOf`'s
   * output against a spelling written here would make this suite a copy of the
   * implementation — it would pass for any two functions that agree, including
   * two that are both wrong. `resolve()` is the independent reader, and it is
   * the one the application actually uses on the way back in.
   *
   * WITNESSED RED by making `hrefOf` skip the encoding — `out.push(value)` —
   * which left §1 GREEN and failed §2 alone, and then by making it drop the
   * leading slash, which failed here with:
   *
   *   `hrefOf('/') must resolve back to '/'`
   *   + actual - expected … 'not-found' !== 'route'
   */
  for (const path of ROUTE_PATHS) {
    it(`${path} round-trips through resolve()`, () => {
      const bound = bindingsFor(path, (name) => `v-${name}`)
      const built = href(path, bound)
      const back = resolve(built)
      assert.equal(
        back.kind,
        'route',
        `hrefOf('${path}') produced '${built}', which resolve() does not recognise as a ` +
          'route at all. The builder and the matcher are the two halves of one closed set ' +
          'and they have come apart.',
      )
      if (back.kind !== 'route') return
      assert.equal(
        back.path,
        path,
        `hrefOf('${path}') produced '${built}', which resolves to '${back.path}'. A builder ` +
          'that writes another route\'s address is worse than one that writes none: every ' +
          'link is live and points somewhere plausible.',
      )
      assert.deepEqual(
        back.params,
        bound,
        `the bindings did not survive the round trip for '${path}'. hrefOf encodes and ` +
          'resolve() does not decode, or the reverse.',
      )
    })
  }

  it('1a · a route with no parameter needs no bindings, and the root is `/`', () => {
    assert.equal(href('/', {}), '/')
    assert.equal(href('/close', {}), '/close')
  })

  /**
   * 🛑 AN EMPTY BINDING IS A THROW, AND THE ALTERNATIVE IS THE DEFECT.
   * `/close/finding/` resolves to `/close/finding`, which is not a route — so
   * a builder that permitted it would hand back a live-looking link that 404s,
   * and the person who wrote the link would meet the failure three screens
   * away from the mistake.
   */
  it('1b · an absent or empty binding throws HERE rather than 404ing THERE', () => {
    assert.throws(
      () => href('/close/finding/:ref', {}),
      /no value for ':ref'/,
      'an absent binding produced a pathname instead of an error',
    )
    assert.throws(
      () => href('/close/finding/:ref', { ref: '' }),
      /no value for ':ref'/,
      'an empty binding produced a pathname instead of an error',
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('2 · 🛑 A PLANE-SUPPLIED ID CANNOT RE-ADDRESS THE LINK IT IS PUT IN', () => {
  /**
   * WHY THIS IS THE SECTION THAT MATTERS.
   *
   * `ExceptionRegister.tsx`'s header forbids building a `href` out of a row
   * field, because a href is a sink React does not escape. The register now
   * does exactly that — every reference cell links to its finding — and the
   * thing standing between that and a defect is `hrefOf`'s
   * `encodeURIComponent`, nothing else. **G97 puts NO format constraint on a
   * branded id in the database**: *"the database enforces no id format"*, so
   * the shape of the value is not a control, and this section is.
   *
   * WITNESSED RED by deleting `encodeURIComponent` from `hrefOf`:
   *
   *   `'x/y' escaped its segment: /close/finding/x/y`
   *   + actual - expected … '/close/finding/:ref' !== '/close/finding/:ref'
   *   … AssertionError: '../../etc' escaped its segment: /close/finding/../../etc
   *
   * Four of the six assertions below fired on that one deletion. The two that
   * did NOT are recorded in 2b, because a control that only fires on the
   * obvious input is a control nobody has measured.
   */
  const hostile: readonly string[] = [
    'x/y',
    '../../etc',
    'a?b=c',
    'a#frag',
    'javascript:alert(1)',
    'a b',
  ]

  for (const value of hostile) {
    it(`2a · ${JSON.stringify(value)} stays ONE segment under /close/finding/`, () => {
      const built = href('/close/finding/:ref', { ref: value })
      assert.ok(
        built.startsWith('/close/finding/'),
        `the built href left the route's static prefix entirely: ${built}`,
      )
      const back = resolve(built)
      assert.equal(
        back.kind,
        'route',
        `${JSON.stringify(value)} produced a pathname that resolves to nothing: ${built}`,
      )
      if (back.kind !== 'route') return
      assert.equal(
        back.path,
        '/close/finding/:ref',
        `${JSON.stringify(value)} escaped its segment: ${built}. An id that can add a ` +
          'segment can address a sibling route — and `/close/finding/:ref/post` is the one ' +
          'with the irreversible act on it.',
      )
      assert.equal(
        back.params['ref'],
        value,
        'the value came back changed, so the encoding is not reversible and the finding ' +
          'the link opens is not the finding the row named',
      )
    })
  }

  /**
   * ⚠️ THE TWO THAT SURVIVE AN UNENCODED BUILD, NAMED RATHER THAN LEFT IN THE
   * LIST TO LOOK LIKE COVERAGE. `a?b=c` and `a#frag` do NOT break the assertions
   * above without encoding, because `resolve()` takes a PATHNAME and never sees
   * a query or a fragment — `table.ts` says so: *"A query string and a fragment
   * are not the router's business."* In a browser they would be stripped by the
   * URL parser before the router ran, so the link would open the WRONG finding
   * silently. That is unreachable from `resolve()` alone, and it is asserted
   * here on the STRING instead.
   */
  /**
   * 🛑 THE DEFECT THIS SECTION ACTUALLY FOUND, ON ITS FIRST RUN, AND IT WAS IN
   * THE MATCHER RATHER THAN IN THE BUILDER — G487, 19 Sep 2026.
   *
   * `resolve()` did not percent-DECODE a bound segment, so the round trip in
   * §2a failed for two of the six values with the builder behaving correctly:
   *
   *     'a%20b' !== 'a b'
   *     'javascript%3Aalert(1)' !== 'javascript:alert(1)'
   *
   * Nothing in the tree could have seen it before this slice, because until
   * `main.tsx` mounted the router nothing built an encoded pathname or read one
   * back — and a BROWSER hands `location.pathname` back encoded. The symptom
   * would have been a 404 for a finding the person can see, on ids containing a
   * space or a colon and on no others.
   */
  it('2c · a decode a browser would have done, and a malformed one refused', () => {
    /* `%2F` is a slash INSIDE the value. Decoding happens after the split, so
       it can never become a second segment — which is what makes decoding
       safe rather than a traversal. */
    const slashy = resolve('/close/finding/a%2Fb')
    assert.equal(slashy.kind, 'route')
    assert.equal(
      slashy.kind === 'route' ? slashy.path : null,
      '/close/finding/:ref',
      'an encoded slash in a value grew a path segment — decoding is happening before the split',
    )
    assert.equal(slashy.kind === 'route' ? slashy.params['ref'] : null, 'a/b')

    /* `decodeURIComponent` THROWS on this. A pathname a person can mistype in
       the address bar must become a 404, never an exception and a blank page. */
    assert.equal(
      resolve('/close/finding/%zz').kind,
      'not-found',
      'a malformed percent sequence must refuse rather than throw — `segmentsOf` states the ' +
        'rule and `bind` had to learn it',
    )
  })

  it('2b · a query or a fragment in an id does not reach the URL as one', () => {
    for (const [value, char] of [['a?b=c', '?'], ['a#frag', '#']] as const) {
      const built = href('/close/finding/:ref', { ref: value })
      assert.ok(
        !built.includes(char),
        `the built href carries a literal ${char}: ${built}. A browser would strip ` +
          'everything after it before the router saw the pathname, so the link would open a ' +
          'DIFFERENT finding with no error — which `resolve()` alone cannot see, because it ' +
          'is handed a pathname that has already been cut.',
      )
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('3 · which clicks the router may swallow', () => {
  /**
   * 🛑 EVERY MODIFIER IS ASSERTED SEPARATELY, AND `altKey` IS THE ONE PEOPLE
   * LEAVE OUT. Alt-click is "save the target" in every major browser; a router
   * that swallows it produces a link that cannot be downloaded, with no error
   * and no symptom. The obvious implementation checks meta and ctrl and stops.
   *
   * WITNESSED RED by dropping `event.altKey` from the disjunction:
   *
   *   `alt-click is "save the target" and must reach the browser`
   *   + actual - expected … true !== false
   */
  it('3a · a plain primary click is ours', () => {
    assert.equal(shouldIntercept(plainClick()), true)
  })

  const refused: readonly (readonly [string, Partial<NavigationClick>, string])[] = [
    ['metaKey', { metaKey: true }, '⌘-click opens a new tab and must reach the browser'],
    ['ctrlKey', { ctrlKey: true }, 'ctrl-click opens a new tab and must reach the browser'],
    ['shiftKey', { shiftKey: true }, 'shift-click opens a new window and must reach the browser'],
    ['altKey', { altKey: true }, 'alt-click is "save the target" and must reach the browser'],
    ['middle button', { button: 1 }, 'the middle button opens a new tab and must reach the browser'],
    ['defaultPrevented', { defaultPrevented: true }, 'something upstream already handled it'],
  ]

  for (const [name, over, why] of refused) {
    it(`3b · ${name} is NOT ours`, () => {
      assert.equal(shouldIntercept(plainClick(over)), false, why)
    })
  }

  it('3c · it DECIDES and does not act — `preventDefault` is never called', () => {
    /* Deciding and acting are separate so the decision is witnessable without
       a spy. If this ever fails, the predicate has grown a side effect and
       every caller has lost the ability to ask without committing. */
    let cancelled = 0
    shouldIntercept(plainClick({ preventDefault: () => { cancelled += 1 } }))
    assert.equal(cancelled, 0, '`shouldIntercept` cancelled the event it was asked about')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('4 · the router, over a fake host', () => {
  /**
   * THE HOST IS FOUR FUNCTIONS AND THAT IS WHY THIS SECTION CAN EXIST AT ALL —
   * `router.ts`: *"EVERY BROWSER SUITE IN THIS REPOSITORY SKIPS WHEN CHROMIUM
   * IS ABSENT, AND A PROPERTY WITNESSED ONLY BY A SKIPPED SUITE IS A PROPERTY
   * WITNESSED BY NOTHING."* Nothing below skips.
   */
  interface Fake {
    readonly host: RouterHost
    readonly focused: string[]
    readonly stack: string[]
    pop(): void
    go(pathname: string): void
  }

  function fakeHost(start: string): Fake {
    const stack: string[] = [start]
    const focused: string[] = []
    let listener: (() => void) | null = null
    return {
      focused,
      stack,
      host: {
        pathname: () => stack[stack.length - 1] ?? '/',
        push: (pathname: string) => { stack.push(pathname) },
        onPop: (fn: () => void) => {
          listener = fn
          return () => { listener = null }
        },
        focus: (id: string) => { focused.push(id) },
      },
      /** The back button: drop an entry, then tell the router. */
      pop: () => {
        stack.pop()
        listener?.()
      },
      /** A history move the router did not make — belt and braces for `pop`. */
      go: (pathname: string) => {
        stack.push(pathname)
        listener?.()
      },
    }
  }

  it('4a · construction resolves where we are and moves NOTHING', () => {
    const fake = fakeHost('/close')
    const router = createRouter(fake.host)
    const here = router.current()
    assert.equal(here.kind, 'route')
    assert.deepEqual(
      fake.focused,
      [],
      'the router grabbed focus on construction. `router.ts`: *"a router that grabbed focus ' +
        'on mount would take it away from a skip link before anybody had pressed a key."*',
    )
    router.stop()
  })

  it('4b · navigate pushes, notifies, and moves focus to the route root', () => {
    const fake = fakeHost('/close')
    const router = createRouter(fake.host)
    const seen: string[] = []
    router.subscribe((r) => { seen.push(r.kind === 'route' ? r.path : `404:${r.pathname}`) })

    router.navigate(href('/close/finding/:ref', { ref: 'exc_1' }))

    assert.deepEqual(seen, ['/close/finding/:ref'], 'the subscriber was not told, or was told twice')
    assert.deepEqual(
      fake.focused,
      ['route-root'],
      'R10: focus must move on a route change, because the browser moves it to the top of a ' +
        'new DOCUMENT and moves it nowhere at all when script swaps the content underneath',
    )
    const now = router.current()
    assert.equal(now.kind === 'route' ? now.params['ref'] : null, 'exc_1')
    router.stop()
  })

  it('4c · navigating to where we already are does nothing at all', () => {
    const fake = fakeHost('/close')
    const router = createRouter(fake.host)
    let told = 0
    router.subscribe(() => { told += 1 })

    router.navigate('/close')

    assert.equal(told, 0, 'a no-op navigation notified subscribers')
    assert.deepEqual(
      fake.focused,
      [],
      '🛑 A STOLEN FOCUS IS WORSE THAN AN UNRESTORED ONE, because it interrupts somebody ' +
        'mid-task rather than merely failing to help them. `router.ts` states this rule and ' +
        'nothing witnessed it until now.',
    )
    assert.deepEqual(fake.stack, ['/close'], 'a no-op navigation added a history entry')
    router.stop()
  })

  it('4d · a 404 is a route change — it notifies AND moves focus', () => {
    const fake = fakeHost('/close')
    const router = createRouter(fake.host)
    const seen: string[] = []
    router.subscribe((r) => { seen.push(r.kind) })

    router.navigate('/audit')

    assert.deepEqual(seen, ['not-found'])
    assert.deepEqual(
      fake.focused,
      ['route-root'],
      '`router.ts`: *"arriving at a 404 with focus left behind on the link you came from is ' +
        'the same defect"*',
    )
    router.stop()
  })

  it('4e · the back button settles, and `stop` really unsubscribes', () => {
    const fake = fakeHost('/close')
    const router = createRouter(fake.host)
    router.navigate('/reports')
    let told = 0
    router.subscribe(() => { told += 1 })

    fake.pop()
    const back = router.current()
    assert.equal(back.kind === 'route' ? back.path : null, '/close', 'the back button was not heard')
    assert.equal(told, 1)

    router.stop()
    fake.go('/ask')
    assert.equal(told, 1, '`stop()` left a listener attached')
    const after = router.current()
    assert.equal(
      after.kind === 'route' ? after.path : null,
      '/close',
      'a stopped router still settled on a history move',
    )
  })

  it('4f · two pathnames that differ only in a BINDING are a route change', () => {
    /* The identity of a resolution is its path AND its parameters — `key()` in
       `router.ts`. A router that compared paths alone would treat moving from
       one finding to the next as staying put: no notification, no focus move,
       and the previous finding left on screen under the new URL. */
    const fake = fakeHost(href('/close/finding/:ref', { ref: 'exc_1' }))
    const router = createRouter(fake.host)
    let told = 0
    router.subscribe(() => { told += 1 })

    router.navigate(href('/close/finding/:ref', { ref: 'exc_2' }))

    assert.equal(told, 1, 'moving between two findings was treated as staying put')
    assert.deepEqual(fake.focused, ['route-root'])
    router.stop()
  })
})
