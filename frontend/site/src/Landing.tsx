/**
 * `/` — THE LANDING PAGE. The pack's `V1 Landing.dc.html`, built for the apex.
 * G3151–G3152, 2 Oct 2026, under the OWNER'S ruling of the same day — *"The
 * marketing site needs building."* — which answers G1968's *"the marketing site
 * does not exist"* for the four pages the pack draws.
 *
 * Section for section, the pack's: the hero, the cost, how it reads, the gap,
 * the six stages, where it runs, the success story, the refusals, who builds
 * it, and the call to action, with the pack's reading rail. The words are the
 * pack's. Where they are not, this header says so rather than shipping them:
 *
 * 🛑 G3152 — THE MARKETPLACE CLAIM AND THE THREE AWS MARKS ARE NOT SHIPPED.
 * The pack's *"Who builds it"* section states that ReconcileAI *"is listed on
 * AWS Marketplace, so it can be bought through your existing AWS agreement and
 * billed against your committed spend"*, links the listing, and draws the AWS
 * Partner, Powered-by-AWS and Available-in-Marketplace marks. `PRODUCT.md`'s
 * G268 note names that sentence as a BREACH — *"a licensing or marketplace
 * claim … is not covered by this clearance; it is tracked as a correction to
 * the surface"* — so this build makes the correction. The paragraph about why
 * 1CloudHub built it and where it is delivered from is the pack's and stays.
 *
 * ⚠️ AND THE PUBLISHER'S MARK IS THE TRUNK'S, NOT A HOTLINK (`PublicPlane.tsx`).
 *
 * 🛑 THE FIGURES ARE THE PACK'S CLEARED FIGURES, VERBATIM — G268, and the tile
 * is `20→7` under G1301. `tests/app/apex-site.test.ts` derives the pack's
 * `class="figure"` values from `V1 Landing.dc.html` and requires this file to
 * carry exactly that set, so a figure added, dropped or edited here is a red.
 * The uncleared market statistics PRODUCT.md names are absent, and the same
 * suite fails if one arrives.
 *
 * ⚠️ THE TWO PROPS THE PACK EXPOSES — `showAbout` and `defaultStory` — take the
 * pack's defaults (shown, and *"A duplicate invoice"*). They are design-tool
 * knobs, not product state.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { cssVar, Publisher, PublicChrome, PublicFooter, PublicFrame, SITE_PATHS } from './PublicPlane.tsx'

/* One field is deliberately below the floor. The meter is a MEASUREMENT and
   nothing else — it never means good, passed or safe. The floor is labelled
   once, on the first row. */
const FIELDS = [
  { name: 'Supplier', value: 'NORDIC PARTS AB', score: '0.97', pct: '97%', t: 'floor 0.60', parked: 'false' },
  { name: 'Invoice no', value: 'INV 4471', score: '0.94', pct: '94%', t: '', parked: 'false' },
  { name: 'Net amount', value: '96,480.00', score: '0.91', pct: '91%', t: '', parked: 'false' },
  { name: 'Tax code', value: 'parked · confirm', score: '0.41', pct: '41%', t: '', parked: 'true' },
] as const

const STORIES = [
  {
    label: 'A duplicate invoice',
    before:
      'The same invoice arrives twice, six weeks apart, under two purchase orders and a supplier name spelled two ways. It clears both times. Somebody finds it in a quarterly review, or nobody does.',
    who: 'Accounts payable, if anyone. Nothing in the ledger says the two rows are the same invoice.',
    after:
      'Both documents are read, the supplier is resolved across both spellings, and the pair is flagged before the second payment runs — with the two documents side by side and the three near-matches it ruled out.',
    human: 'Confirms it is the same invoice and applies the SOP. The proposal is drafted; the decision is not.',
  },
  {
    label: 'An unaccounted charge',
    before:
      'A charge on the statement with no receipt behind it. Someone pulls the bank feed, walks back through goods receipts, and finds one that was reversed after the match. Half a day, and the answer is one sentence long.',
    who: 'Whoever has the context, which is usually one person and usually not available in the close week.',
    after:
      'The question is asked in words — which of these charges was never accounted for — and answered from the source systems with the four that qualify, the receipt that was reversed, and a confidence on each.',
    human: 'Decides what to do about it. The detective work is finished before the week starts.',
  },
  {
    label: 'A compliance deadline',
    before:
      'The evidence exists across four systems and one inbox. Assembling it for a reviewer is a person’s week, and the assembly is thrown away afterwards.',
    who: 'Finance, then whoever owns the control, then finance again.',
    after:
      'Every run carries its scope, its time, its sources and an audit id. The evidence is the register rather than something reconstructed from it.',
    human: 'Reads it, and signs. The trail says who decided what, and when.',
  },
] as const

const SECTIONS = [
  { id: 'work', label: 'The work' },
  { id: 'cost', label: 'The cost' },
  { id: 'how', label: 'How it reads' },
  { id: 'gap', label: 'The gap' },
  { id: 'platform', label: 'The platform' },
  { id: 'runs', label: 'Where it runs' },
  { id: 'proof', label: 'Success stories' },
  { id: 'refuses', label: 'What it refuses' },
  { id: 'who', label: 'Who builds it' },
  { id: 'demo', label: 'Book a demo' },
] as const

const STAGES = [
  ['1 · Arrive', 'Intake', 'Upload, S3 or SFTP, email, or a connector into your source systems.'],
  ['2 · Read', 'Extraction', 'Typed values with a confidence each. Below the floor is parked, not guessed.'],
  ['3 · Pair', 'Matching', 'Definitions and rules produce match groups across systems.'],
  ['4 · Judge', 'Exceptions', 'Severity, an explanation, and the candidates it ruled out.'],
  ['5 · Act', 'Resolution', 'Your SOPs, as proposals. Above an authority limit it stops and waits.'],
  ['6 · Show', 'Reporting', 'A register that states its scope and its denominator, and exports on a schedule.'],
] as const

/**
 * A cleared figure, drawn as the pack draws the V1 tile. The pack writes
 * `line-height:1`; N-07 (G3487) binds it to `--lh-solid`, the kernel's name for
 * exactly 1 — a one-line box, which a display figure is. Same value, named.
 */
function Figure({ value, caption }: { readonly value: string; readonly caption: string }): ReactNode {
  return (
    <span style={{ display: 'block' }}>
      <b
        className="figure"
        style={{ display: 'block', fontSize: 'var(--s6)', fontWeight: 'var(--w-lede)', lineHeight: 'var(--lh-solid)' }}
      >
        {value}
      </b>
      <span className="small" style={{ display: 'block', marginTop: 'calc(var(--u)*2)' }}>
        {caption}
      </span>
    </span>
  )
}

/**
 * The rail follows the reader rather than the click: an observer, one callback
 * per crossing, the topmost intersecting section wins — the pack's own logic.
 */
function useActiveSection(): readonly [string, (id: string) => void] {
  const [active, setActive] = useState<string>('work')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const top = seen[0]
        if (top !== undefined) setActive(top.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    for (const sec of SECTIONS) {
      const el = document.getElementById(sec.id)
      if (el !== null) io.observe(el)
    }
    return () => io.disconnect()
  }, [])
  return [active, setActive]
}

export function Landing(): ReactNode {
  const [active, setActive] = useActiveSection()
  const [storyIndex, setStoryIndex] = useState(0)
  const story = STORIES[storyIndex] ?? STORIES[0]

  return (
    <PublicFrame page="home">
      <a className="skip" href="#how">Skip to how it works</a>
      <PublicChrome page="home" />

      <div className="shell">
        <nav className="rail-nav" aria-label="On this page">
          <ol>
            {SECTIONS.map((sec, i) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  aria-current={sec.id === active ? 'true' : undefined}
                  onClick={() => setActive(sec.id)}
                >
                  <i className="dash" aria-hidden="true" />
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="t">{sec.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main>
          {/* ═══ HERO ═══ */}
          <section className="band" id="work">
            <div className="wrapper split split--hero">
              <div className="side" style={{ position: 'static' }}>
                <span className="eyebrow">Agentic reconciliation · 1CloudHub</span>
                <h1>Everyone adopted AI. Almost nobody pointed it at the close.</h1>
                <p className="stand">
                  Reconciliation is where finance still does the reading by hand. ReconcileAI reads
                  every document, pairs it, judges what does not agree, and proposes the resolution —
                  then stops, and waits for a person to decide.
                </p>
                <div className="acts">
                  <a className="btn btn--lg" data-commit href={SITE_PATHS.demo}>Book a demo</a>
                  <a className="btn btn--lg" href="#how">See how it reads a document</a>
                </div>
                <p className="small" style={{ marginTop: 'calc(var(--u)*8)' }}>
                  Runs in your own AWS account if you need it to. Complementary to SAP and non-SAP
                  systems — it does not replace your ERP, it reconciles across what you already run.
                </p>
              </div>

              <div className="main">
                <div className="stack" style={{ marginTop: 0 }}>
                  <div className="sheetdoc">
                    <span className="dt">Purchase order</span>
                    <span className="lines"><i style={{ width: '62%' }} /><i style={{ width: '88%' }} /></span>
                  </div>
                  <div className="sheetdoc">
                    <span className="dt">Goods receipt</span>
                    <span className="lines"><i style={{ width: '74%' }} /><i style={{ width: '54%' }} /></span>
                  </div>
                  <div className="sheetdoc">
                    <span className="dt">Invoice 4471 <i className="mark" aria-hidden="true" /></span>
                    <span className="lines">
                      <i style={{ width: '80%' }} /><i style={{ width: '66%' }} /><i style={{ width: '42%' }} />
                    </span>
                    <span className="chip lit">matching · 3 documents</span>
                  </div>
                </div>
                <p className="small" style={{ marginTop: 'calc(var(--u)*4)' }}>
                  Three documents, one of which does not agree with the other two. Everything the
                  product does starts here. <b>Illustrative</b> — no customer document is shown
                  anywhere on this site.
                </p>
              </div>
            </div>
          </section>

          {/* ═══ THE COST ═══ */}
          <section className="band band--sheet" id="cost">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">The cost</span>
                <h2>None of this is abstract. It is a person opening a spreadsheet.</h2>
              </div>
              <div className="main">
                <p>
                  Every exception in the pile is somebody pulling a statement, calling a supplier,
                  finding the goods receipt that was reversed, and writing down what they concluded so
                  the next person does not have to work it out again. The work is not hard. There is
                  simply too much of it, and it all lands in the same five days.
                </p>
                <ul className="list">
                  <li>
                    <span className="mk">~</span>
                    <span>
                      <b>Days, not minutes.</b> The close waits on exceptions, and exceptions wait on
                      whoever has the context. The tilde is deliberate — that is an estimate, and the
                      product marks every number it is guessing at.
                    </span>
                  </li>
                  <li>
                    <span className="mk">›</span>
                    <span>
                      <b>The judgement is the valuable part</b>, and it is the part that gets rushed,
                      because the reading ate the time.
                    </span>
                  </li>
                  <li>
                    <span className="mk">…</span>
                    <span>
                      <b>And some of it is not yours to finish.</b> A charge nobody can account for is
                      blocked on a bank, a supplier or another team — work that is real, moving, and
                      moving somewhere else.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* ═══ HOW IT READS ═══ */}
          <section className="band" id="how">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">How it reads</span>
                <h2>It reads the document before it matches it.</h2>
              </div>
              <div className="main">
                <p>
                  Any layout, any language. Fields are lifted with a confidence score, and{' '}
                  <b>anything below the floor is parked for a person to confirm rather than guessed
                  at</b>. That floor is set per document pack by our delivery team, not left to a
                  default — a pack with no floor refuses to run.
                </p>
                <div className="cols cols--two">
                  <div className="panel">
                    <span className="tag">Extraction · field by field</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--u)*3)' }}>
                      {FIELDS.map((f) => (
                        <div key={f.name} className="fieldrow" data-parked={f.parked}>
                          <span className="top">
                            <span className="fname">{f.name}</span>
                            <span className="fval mono">{f.value}</span>
                          </span>
                          <span className="meter" style={{ ...cssVar('--score', f.pct), ...cssVar('--floor', '60%') }}>
                            <span className="v mono">{f.score}</span>
                            <span className="tick" data-t={f.t} />
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="small" style={{ marginTop: 'calc(var(--u)*4)' }}>
                      One field is deliberately parked. The bar is a measurement and nothing else — it
                      never means good, passed or safe.
                    </p>
                  </div>
                  <div className="panel">
                    <span className="tag">What a person sees next</span>
                    <p>
                      <b>Needs confirmation <span className="mono">›</span></b>
                      <br />
                      <span className="small">
                        Tax code read at 0.41, below the 0.60 floor. The document is shown beside the
                        field, and confirming it teaches the pack rather than patching the row.
                      </span>
                    </p>
                    <p>
                      <b>Ruled out <span className="mono">—</span></b>
                      <br />
                      <span className="small">
                        Three candidate matches the model considered and rejected, with the reason for
                        each. The ruled-out list is what makes a proposal reviewable instead of a
                        verdict.
                      </span>
                    </p>
                    <p>
                      <b>Run completed 03:12</b>
                      <br />
                      <span className="small">
                        Past tense, with a time on it. A figure the system is certain of never wears a
                        hedge, so a number without one is a number you can rely on.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ THE GAP ═══ */}
          <section className="band band--sheet" id="gap">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">The gap</span>
                <h2>Pick an exception. Watch what it costs.</h2>
              </div>
              <div className="main">
                <p>
                  Three exception types, three different teams, one shape. Something is knowable from
                  the documents, and nobody has had time to go and know it.
                </p>
                <div className="choices" style={{ marginTop: 'calc(var(--u)*6)' }}>
                  {STORIES.map((s, i) => (
                    <button
                      key={s.label}
                      className="choice"
                      type="button"
                      aria-pressed={i === storyIndex}
                      onClick={() => setStoryIndex(i)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="cols cols--two" style={{ marginTop: 'calc(var(--u)*5)' }}>
                  <div className="panel">
                    <span className="tag">Today</span>
                    <p>{story.before}</p>
                    <p className="small"><b>Whose move.</b> {story.who}</p>
                  </div>
                  <div className="panel" data-pick="true">
                    <span className="tag">With ReconcileAI</span>
                    <p>{story.after}</p>
                    <p className="small"><b>What the person still does.</b> {story.human}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ THE SIX STAGES ═══ */}
          <section className="band" id="platform">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">The platform</span>
                <h2>One path, six stages — and a person owns the last one.</h2>
              </div>
              <div className="main">
                <p>
                  Everything in the product serves one of these or governs it. The agent runs every
                  stage; naming it says nothing. <b>A person in the loop is the exception, so that is
                  what gets named.</b>
                </p>
                <div className="rail">
                  {STAGES.map(([n, nm, ds]) => (
                    <div key={n}>
                      <div className="stage">
                        <span className="n">{n}</span>
                        <span className="nm">{nm}</span>
                        <span className="ds">{ds}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="small" style={{ marginTop: 'calc(var(--u)*6)' }}>
                  <b>Ask is a capability before it is a destination.</b> Any question about the
                  period, in words — no SQL, no export request, no ticket — answered from the source
                  systems with a confidence and the cost of the answer. It opens over the register
                  rather than taking you away from it.
                </p>
              </div>
            </div>
          </section>

          {/* ═══ WHERE IT RUNS ═══ */}
          <section className="band band--sheet" id="runs">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">Where it runs</span>
                <h2>Two deployments, and the harder one is the one enterprises ask for.</h2>
              </div>
              <div className="main">
                <p>
                  Your documents are the most sensitive thing in the close. So the question of{' '}
                  <em>whose account they sit in</em> is not a deployment detail, it is the first thing a
                  security review asks.
                </p>
                <div className="cols cols--two">
                  <div className="panel">
                    <span className="tag">Hosted</span>
                    <p>We run it. Fastest to a first reconciliation, and the default for a partner-sold tenant.</p>
                    <p className="small">
                      Your data sits in our account under your retention and residency settings, and the
                      audit trail is yours.
                    </p>
                  </div>
                  <div className="panel" data-pick="true">
                    <span className="tag">Your own AWS account · BYOA</span>
                    <p>
                      <b>The product deploys into your account.</b> Your documents, your KMS keys, your
                      Bedrock quota, your bill — and your connector credentials in your own Secrets
                      Manager, which we never see.
                    </p>
                    <p className="small">
                      The application is served from our CloudFront and your browser calls your own API
                      directly, so <b>tenant data never transits a 1CloudHub account.</b> The code comes
                      from us and executes against your data in your user&rsquo;s browser — stated
                      plainly here because a security review will ask about exactly that.
                    </p>
                  </div>
                </div>
                <ul className="list">
                  <li>
                    <span className="mk">›</span>
                    <span>
                      <b>Half of onboarding is yours.</b> The key exchange, the model pre-flight,
                      identity federation and the connector credentials all happen inside your account,
                      by your people. We track a state per step so &ldquo;why are we not live yet&rdquo;
                      always has an answer.
                    </span>
                  </li>
                  <li>
                    <span className="mk">›</span>
                    <span>
                      <b>Your identity provider, your roles.</b> OIDC or SAML, at your own host. There is
                      no ReconcileAI password.
                    </span>
                  </li>
                  <li>
                    <span className="mk">…</span>
                    <span>
                      <b>Escalating hosted to your own account moves everything</b> — documents, runs,
                      resolutions, approvals and the audit trail. A partial migration is a lost history
                      wearing a better word.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* ═══ SUCCESS STORIES — the cleared figures, G268, tile 20→7 under G1301 ═══ */}
          <section className="band" id="proof">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">Success stories</span>
                <h2>One engagement on the record. Two more being cleared.</h2>
              </div>
              <div className="main">
                <p>
                  Every client here is unnamed at their request, and every figure is one the client
                  agreed to. Where a story is not cleared yet, the slot says so rather than being filled
                  with something weaker.
                </p>

                <div className="panel" data-pick="true" style={{ marginTop: 'calc(var(--u)*8)' }}>
                  <span className="tag">Real estate · Philippines · GenAI</span>
                  <p><b>A 9-step manual payables process, read and matched by an agent.</b></p>
                  <p className="small">
                    A premier Philippine real estate conglomerate — 90 buildings, 3.4M sqm, 1,000+
                    employees. Vendors upload the pack, fields are extracted and three-way matched
                    across purchase order, goods receipt and supplier invoice, and the team reviews only
                    what is flagged.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit,minmax(calc(var(--u)*40),1fr))',
                      gap: 'calc(var(--u)*6)',
                      marginTop: 'calc(var(--u)*6)',
                    }}
                  >
                    <Figure value="65%" caption="Less processing time per transaction" />
                    <Figure value="20→7" caption="Minutes per transaction" />
                    <Figure value="727 hrs" caption="Saved per month at 2026 volumes" />
                  </div>
                  <p className="small" style={{ marginTop: 'calc(var(--u)*6)' }}>
                    Extraction held above 85% across 58+ vendor document formats. A two-week proof of
                    concept came first, then production in phases. Engagement period June 2025 —
                    ongoing.
                  </p>
                  <div className="acts" style={{ marginTop: 'calc(var(--u)*6)' }}>
                    <a className="btn" href={SITE_PATHS.story}>Read the full story</a>
                  </div>
                </div>

                <div className="cols cols--two">
                  <div className="panel">
                    <span className="tag">Story two · slot open</span>
                    <p><b>Not written yet.</b></p>
                    <p className="small">
                      Reserved for a second engagement. Sector, geography, the exception type it started
                      on, and the figures the client will stand behind. Nothing goes in this slot until
                      they are agreed in writing.
                    </p>
                  </div>
                  <div className="panel">
                    <span className="tag">Story three · slot open</span>
                    <p><b>Not written yet.</b></p>
                    <p className="small">
                      Reserved for a third engagement, ideally in a different industry and a different
                      deployment mode to the first — so the three together say the product is not shaped
                      around one landscape.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ WHAT IT DOES NOT DO ═══ */}
          <section className="band" id="refuses">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">What it does not do</span>
                <h2>The refusals are the product, as much as the features are.</h2>
              </div>
              <div className="main">
                <p>
                  A reconciliation engine that quietly decides things is worth less than one that
                  stops. These are deliberate, and they are on the record.
                </p>
                <ul className="list list--two">
                  <li>
                    <span className="mk">✕</span>
                    <span>
                      <b>It does not post above an authority limit.</b> The agent proposes; a named
                      person approves, with a required reason. The reason is what an SOP amendment gets
                      drafted from.
                    </span>
                  </li>
                  <li>
                    <span className="mk">✕</span>
                    <span><b>It does not guess a field below the confidence floor.</b> It parks it and asks.</span>
                  </li>
                  <li>
                    <span className="mk">✕</span>
                    <span>
                      <b>No colour carries a state.</b> Every status is a word. Nothing in the interface
                      depends on your being able to tell green from amber.
                    </span>
                  </li>
                  <li>
                    <span className="mk">✕</span>
                    <span>
                      <b>It does not answer questions it cannot evidence.</b> An answer arrives with a
                      confidence, and a confidence below the floor arrives as a question.
                    </span>
                  </li>
                  <li>
                    <span className="mk">✕</span>
                    <span>
                      <b>There is no self-serve sign-up.</b> A tenant carries a deployment mode, a
                      residency, a retention policy and a support-access mode — four decisions with no
                      safe defaults, so a person makes them with you.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* ═══ ABOUT — G3152: no marketplace claim, no AWS marks ═══ */}
          <section className="band band--sheet" id="who">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">Who builds it</span>
                <h2>Built by 1CloudHub, on AWS.</h2>
              </div>
              <div className="main">
                <p>
                  We built ReconcileAI because we kept meeting the same gap in every finance landscape
                  we were asked to modernise: the systems were current, the reconciliation was still
                  manual, and nobody had pointed the new tooling at the part that actually consumed the
                  week.
                </p>
                <p className="small">
                  Offices in Singapore, India, the United States, Dubai and the Philippines. Delivered
                  by the same engineers who run the onboarding.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'calc(var(--u)*8)',
                    alignItems: 'flex-start',
                    marginTop: 'calc(var(--u)*8)',
                  }}
                >
                  <Publisher label="The company" />
                </div>
              </div>
            </div>
          </section>

          {/* ═══ CTA ═══ */}
          <section className="band band--last" id="demo">
            <div className="wrapper split">
              <div className="side">
                <span className="eyebrow">Start narrow</span>
                <h2>Bring us one exception type.</h2>
              </div>
              <div className="main">
                <p className="stand">
                  Forty-five minutes on your landscape, your exception types and who needs to see what.
                  The demo runs on a real reconciliation against synthetic documents, not a slide deck.
                </p>
                <div className="acts">
                  <a className="btn btn--lg" data-commit href={SITE_PATHS.demo}>Book a demo</a>
                </div>
              </div>
            </div>
          </section>

          <PublicFooter
            page="home"
            withPublisher
            disclaimer={
              <>
                Every document and score on this page is illustrative. No logo, testimonial, price, SLA
                or benchmark is named, because none has been established. The figures under Success
                stories are the exception: they come from a delivered engagement, and the client is
                unnamed under a mutual NDA.
              </>
            }
          />
        </main>
      </div>
    </PublicFrame>
  )
}
