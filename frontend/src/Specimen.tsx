import { Connection } from './components/Connection.tsx'
import { Elsewhere, Hedge, Stated, YourMove } from './components/Grammar.tsx'
import { Luminous } from './components/Luminous.tsx'
import { Meter } from './components/Meter.tsx'
import { NotBuilt } from './components/NotBuilt.tsx'
import { Person } from './components/Person.tsx'
import { SkipLink } from './components/SkipLink.tsx'

/**
 * THE SPECIMEN — the ported primitives in their states, on one page.
 *
 * ⚠️ THIS HEADING READ "the THREE ported primitives" AND THE FOUR GRAMMAR
 * INDICATORS ENDED IT. It is corrected rather than deleted because "three" is
 * the number a reader would carry away and then check the page against. The
 * three that crossed the bridge first — the hatch, the meter, the connection
 * light — are still the three the bridge argument is ABOUT; what joined them is
 * the rest of the SIX INDICATORS, which paint nothing and therefore prove
 * nothing about the cascade. They are here so the count is six on a page rather
 * than only in a roster.
 *
 * This is BOTH the dev surface (`npm run dev:frontend`) and the page the build
 * pre-renders to `frontend/dist/specimen.html`, which is what
 * tests/design/frontend-bridge.test.ts loads over `file://`. One source, so the
 * page that is asserted is the page that ships — render.ts's header argues that
 * at length, and the alternative it rejects is a test that re-compiles the bridge
 * for itself and therefore measures a build nobody uses.
 *
 * ⚠️ EVERY FIGURE HERE IS ILLUSTRATIVE AND MUST STAY SO. PRODUCT.md: "NEVER
 * present in-product figures as customer results." 0.91 is not a result; it is a
 * number chosen to sit above the floor so the tick is visible.
 *
 * 🛑 WHAT THIS PAGE IS NOT. Not a route, not an operation, not a capability.
 * G200 freezes serving at four operations and this slice mints no G row. The
 * four `.nb` marks below stand in for real refused features and carry real
 * decisions; they are annotations on a primitive, not a screen.
 *
 * ⚠️ THE ORDER OF THE TWO CONNECTION LIGHTS IS LOAD-BEARING — the live one is
 * FIRST. The kernel gives a DOWN light `opacity:0` on its halo, so anything
 * reading the first `.conn i` on this page to check the reduced-motion guard
 * would find a permanently still ring and report the guard broken when it is not.
 *
 * 🛑 AND SO IS THE ORDER OF THE FIRST TWO ELEMENTS, WHICH IS A PROPERTY OF THIS
 * FILE AND OF NO COMPONENT. `<SkipLink/>` IS FIRST IN THE DOCUMENT, before the
 * `<main>` it targets. A skip link that is not the first focusable element skips
 * whatever the user already tabbed through to reach it — so moving it, or
 * putting any focusable thing above it, breaks the only state it has. Its target
 * id lives on the `<main>` below and nothing but the test resolves it.
 *
 * ⚠️ COUNTS THIS PAGE IS HELD TO, and they are exact rather than approximate
 * because two suites assert them: ONE `.hu`, ONE `.skip`, ONE `.lit`, and the
 * meter's two lines and the two connection lights' four dots UNMOVED. The light
 * count is the kernel's own rule — "never on more than one thing per view" — so
 * the attacker matrix that `.nb` gets four marks for cannot be spelled here; the
 * one light carries the single real attacker, `bg-linear-to-r`, and the rest of
 * the matrix runs at engine level in tests/design/more-primitives.test.ts §1.
 */
export function Specimen() {
  return (
    <>
    <SkipLink target="specimen">Skip to the specimens</SkipLink>
    <main id="specimen" className="p-6 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">The kernel under Tailwind</h1>
        <p className="text-label text-muted">
          Three primitives, ported. The treatment on every one of them is the
          kernel&rsquo;s; this page declares no colour, no radius and no type size
          of its own. Figures are illustrative.
        </p>
      </header>

      {/* ── THE HATCH ─────────────────────────────────────────────────────
          FOUR MARKS, AND THE UTILITY ON EACH IS THE POINT. `bg-white` writes
          background-COLOR and is the NEAR MISS — it must not reach the hatch.
          `bg-none` and `bg-linear-to-r` write background-IMAGE and are the two
          that erase it under any arrangement but this one. The bare mark is the
          control: if it loses the hatch, the kernel itself has stopped painting
          and nothing else on this page is worth reading. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-label text-muted">Refused features — the hatch</h2>

        <NotBuilt refusedBy="G200" why="serving is frozen at four operations">
          A fifth operation on the served path
        </NotBuilt>

        <NotBuilt
          className="bg-white"
          refusedBy="G110"
          why="the publication seam is blocked on an administration contract that does not exist"
        >
          Pack publication refusing at the seam
        </NotBuilt>

        <NotBuilt
          className="bg-none"
          refusedBy="G76"
          why="check-plane-tags.mjs has no call site and is not in tools/"
        >
          The plane-tag checker
        </NotBuilt>

        <NotBuilt
          className="bg-linear-to-r"
          refusedBy="G109"
          why="the $ref half is unbuilt — the wire mirror is a line scanner and resolves no $ref chain"
        >
          Recursive $ref conformance
        </NotBuilt>
      </section>

      {/* ── THE ONLY LINE ─────────────────────────────────────────────────
          🛑 `items-start` IS LOAD-BEARING AND WAS ADDED AFTER LOOKING AT THE
          RENDERED PAGE. The kernel declares `.meter{display:inline-block}` so it
          sizes to its figure; a flex column stretches its children, and the
          meter came out as a bar spanning the full width of the page. NO SECOND
          LINE WAS ADDED AND THE RULE WAS BREACHED ANYWAY — a hairline running
          the whole width of a view reads as a progress bar, which is exactly
          what THE ONE LINE RULE forbids the meter from being mistaken for. It
          also drove the floor tick's label onto the bar, because at that width
          60% lands mid-line instead of past the end.
          THE DETECTORS DID NOT CATCH THIS AND COULD NOT: the count was still
          two, both still belonged to the meter, and every assertion passed. The
          kernel's own specimen puts the meter in a plain block container
          (design/system/index.html, `div.stage`) for the same reason. */}
      <section className="flex flex-col items-start gap-2">
        <h2 className="text-label text-muted">
          The confidence meter — a measurement, always
        </h2>
        <Meter score={0.91} floor={0.6} floorLabel="floor" />
      </section>

      {/* ── THE ONLY DOT ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label text-muted">
          The connection light — its halo is the life signal
        </h2>
        <Connection state="up">
          agent reading <span className="mono">71</span> lines
        </Connection>
        <Connection state="down">
          <b>unreachable</b> since 09:12
        </Connection>
      </section>

      {/* ── THE FOUR GRAMMAR INDICATORS ───────────────────────────────────
          🛑 THE SIX ARE NOW ALL SIX, AND THAT IS THE POINT OF THIS SECTION.
          Two are marks and were already here; four are grammar and were not,
          which made this the one layer of the vocabulary a component library
          could silently grow — R5 says a seventh is a DESIGN CHANGE, not an
          addition, and a rule of that kind survives only where the count is
          mechanised. It is mechanised in `components/indicators.ts`, and the
          four below render their characters OUT OF that roster rather than
          spelling them.

          ⚠️ THEY PAINT NOTHING, DELIBERATELY, so nothing in this section may
          move the two counts this page is held to: the meter's two lines and
          the two connection lights' four dots. Grammar carries no CSS — the
          moment one of these gains a stylesheet it has become a third MARK. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label text-muted">
          The four grammar indicators — no CSS, and no seventh
        </h2>
        <p className="text-label">
          <Hedge>4 hours to clear</Hedge> — a figure the system is guessing at
          wears the hedge, so a number without one is a number somebody can rely
          on. Every figure here is illustrative.
        </p>
        <p className="text-label">
          <Stated verb="completed" at="03:12">Run</Stated> — the tense carries
          the certainty, and the time is what makes it a fact rather than a claim
          about now.
        </p>
        <p className="text-label">
          <YourMove>Needs authority</YourMove> — the agent ran every row, so a
          person in the loop is the exception and the chevron is where the work
          stops until one acts.
        </p>
        <p className="text-label">
          <Elsewhere>Waiting on the bank feed</Elsewhere> — not
          &ldquo;loading&rdquo;. The work is real, it is moving, and it is not
          moving here.
        </p>
      </section>

      {/* ── THE PERSON ────────────────────────────────────────────────────
          THE EXCEPTION, NAMED. The agent ran every row, so naming it says
          nothing. The mark is used INLINE IN A SENTENCE, which is how the design
          record uses it — `grep -rn 'class="hu"' design/system/*.html` returns
          four, every one of them mid-sentence beside a verb ("· you approve") —
          rather than as a standalone chip: a chip is a filled box, and a filled
          box beside a name is one step from an avatar.
          ⚠️ THE NAME IS ILLUSTRATIVE, like every figure on this page. It is not
          a customer, a user or a result. PRODUCT.md governs. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label text-muted">
          The person — the exception, named
        </h2>
        <p className="text-label">
          The agent cleared every row it could. <Person>asha</Person> reviewed
          the three it could not, and the record says so beside them.
        </p>
      </section>

      {/* ── THE LUMINOUS TOUCH ────────────────────────────────────────────
          ⚠️ THIS BLOCK READ "DELIBERATELY NOT PORTED AS A COMPONENT" AND SAID
          THE SLICE WAS SCOPED TO THREE PRIMITIVES. Both were true when written
          and both ended here; the sentence is replaced rather than deleted
          because a reader would have taken the raw `<div className="lit">` below
          it as the intended shape. It is <Luminous/> now, for one reason that
          the raw element could not reach: `focusable`. A `.lit` that cannot take
          focus can never witness the focus ring, and the ring on a lit element
          was MEASURED GONE on 17 Aug 2026 — see Luminous.tsx, and the kernel's
          own `.lit:focus-visible`, which is where that defect is repaired.

          THE THREE THINGS THIS ONE ELEMENT CARRIES, each deliberate:
            `bg-linear-to-r` the real attacker — a background-IMAGE utility on
                             the light's own element. `.lit.lit` must outrank it.
                             It is in bridge.css's `@source inline` list, so it
                             COMPILES; an intruder spelled as an unlisted utility
                             compiles to nothing and is caught by nothing.
            `p-4`            the collision boundary: the kernel declares no
                             padding on `.lit`, so a utility reaches it.
            focusable        the tab stop, and the only reason the ring on a lit
                             element is measurable anywhere in this repository.
          AND EXACTLY ONE LIGHT. "Never on more than one thing per view — one
          light is legible, six lights are wallpaper." */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label text-muted">
          The luminous touch — one slow pass, never a spinner
        </h2>
        <Luminous running focusable className="bg-linear-to-r p-4">
          The machine is working on this right now
        </Luminous>
      </section>
    </main>
    </>
  )
}
