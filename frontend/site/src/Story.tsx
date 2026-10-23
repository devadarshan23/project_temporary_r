/**
 * `/story/` — THE SUCCESS STORY. The pack's `V4 Success Story.dc.html`, built
 * for the apex. G3151, G3154, 2 Oct 2026, under the OWNER'S ruling of the same
 * day.
 *
 * ⚠️ G3154 — THE PATH IS THIS BUILD'S, BECAUSE THE PACK NAMES NONE. The pack's
 * public-plane route table lists `/`, `/demo`, `/lookup` and `/entry`; V4 is
 * reached only by V1's *"Read the full story"* button, as a file link. `/story/`
 * is the shortest name that says what the page is, and it is not added to the
 * application's route table, because that table is the DATA plane's and this
 * page is not served there.
 *
 * 🛑 EVERY FIGURE IS THE PACK'S CLEARED FIGURE, VERBATIM — G268 clears this
 * engagement's outcome and scale figures *"on the public marketing plane only —
 * V1 Landing and V4 Success Story"*, and the tile is `20→7` under G1301.
 * `tests/app/apex-site.test.ts` derives the pack's `class="figure"` values from
 * `V4 Success Story.dc.html` and requires the built page to carry exactly that
 * multiset. The client is not named, and nothing here names it.
 *
 * ⚠️ G1910 IS INHERITED, NOT CLOSED: `727 hrs` is captioned *"at projected 2026
 * volumes"* and wears no tilde while the page says *"every projected number on
 * this page wears one"*. That disagreement is the pack's and is the owner's to
 * resolve; copying the figure faithfully is what keeps the join test honest.
 */

import type { ReactNode } from 'react'

import { cssVar, PublicChrome, PublicFooter, PublicFrame, SITE_PATHS } from './PublicPlane.tsx'

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

function Scale({ value, caption }: { readonly value: string; readonly caption: string }): ReactNode {
  return (
    <span style={{ display: 'block' }}>
      <b className="figure" style={{ display: 'block', fontSize: 'var(--s4)' }}>
        {value}
      </b>
      <span className="small">{caption}</span>
    </span>
  )
}

function FromTo({ label, from, to }: { readonly label: string; readonly from: string; readonly to: string }): ReactNode {
  const big = { fontSize: 'var(--s6)', fontWeight: 'var(--w-lede)', lineHeight: 'var(--lh-solid)' } as const
  return (
    <span style={{ display: 'block' }}>
      <span className="small" style={{ display: 'block', fontSize: 'var(--s1)', letterSpacing: 'var(--tr-micro)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 'calc(var(--u)*4)', marginTop: 'calc(var(--u)*2)' }}>
        <b className="figure" style={{ ...big, color: 'var(--recede)' }}>{from}</b>
        <span className="mono" style={{ color: 'var(--muted)' }} aria-hidden="true">→</span>
        <b className="figure" style={big}>{to}</b>
      </span>
    </span>
  )
}

const BAR = { display: 'flex', alignItems: 'center', gap: 'calc(var(--u)*3)' } as const

function Year({
  year,
  manual,
  manualWidth,
  assisted,
  assistedWidth,
  transactions,
}: {
  readonly year: string
  readonly manual: string
  readonly manualWidth: string
  readonly assisted: string
  readonly assistedWidth: string
  readonly transactions: string
}): ReactNode {
  return (
    <>
      <span className="small" style={{ fontFamily: 'var(--face-mono)' }}>{year}</span>
      <span style={{ display: 'block' }}>
        <span style={BAR}>
          <i style={{ display: 'block', height: 'calc(var(--u)*2)', width: manualWidth, backgroundColor: 'var(--ink)' }} />
          <span className="small"><b>{manual}</b> manual</span>
        </span>
        <span style={{ ...BAR, marginTop: 'calc(var(--u)*2)' }}>
          <i style={{ display: 'block', height: 'calc(var(--u)*2)', width: assistedWidth, backgroundColor: 'var(--accent)' }} />
          <span className="small">{assisted} AI-assisted · {transactions} transactions</span>
        </span>
      </span>
    </>
  )
}

const BEFORE = [
  ['Counter billing documents', 'Paper-based receipt'],
  ['Encode to weekly payable monitoring', 'Internal Excel'],
  ['Review and validation of documents', 'Manual checking'],
  ['Generate goods receipt', 'SAP system entry'],
  ['Prepare request for payment', 'Manual RFP prep'],
  ['Encode billing to RCDT', 'Excel monitoring'],
  ['Routing for approval', 'Manual'],
  ['Scanning of RFPs', 'Manual'],
  ['Transmittal to finance', 'Manual'],
] as const

const AFTER = [
  ['Vendor uploads documents via portal', 'Vendor · PO · SI · GRN · DR'],
  ['Fields extracted and validated', 'Agent · three-way match'],
  ['Team reviews flagged items', 'Person · only what was flagged'],
  ['Request for payment auto-generated', 'Agent · pre-filled from extracted data'],
  ['Encode billing to RCDT', 'Person · internal Excel monitoring'],
  ['Routing for approval', 'Person · system-guided workflow'],
  ['System transfers to finance', 'Agent · payment voucher auto-generated'],
] as const

const CHALLENGES = [
  'Vendors submitted combined PDFs, which had to be unbundled before a three-way match could run at all.',
  'Transaction volumes more than doubled mid-engagement, raising the scalability bar after the design was set.',
  'Dual-entity support required isolated workflows on shared infrastructure.',
  'SAP integration was deferred, so the Excel-based RCDT monitoring had to be bridged as an interim.',
  'Document formats varied across 58+ vendor types, which broadened what the extraction had to handle.',
] as const

const STACK = [
  'AWS',
  'Amazon Bedrock',
  'Intelligent document processing',
  'Agentic workflow engine',
  'Three-way match logic',
  'Role-based access control',
  'RFP and voucher generation',
  'KPI dashboards',
  'PDF unbundling',
  'In-app notifications',
] as const

function Steps({ items }: { readonly items: readonly (readonly [string, string])[] }): ReactNode {
  return (
    <ul className="list" style={{ marginTop: 0 }}>
      {items.map(([step, how], i) => (
        <li key={`${String(i)}-${step}`}>
          <span className="mk">{i + 1}</span>
          <span>
            {step}
            <br />
            <span className="small">{how}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Mascot({ size }: { readonly size: string }): ReactNode {
  return (
    <span className="mascot" data-energy="working" style={{ ...cssVar('--mascot-size', size), flex: 'none' }} aria-hidden="true">
      <i className="d1">·</i>
      <i className="d2">·</i>
      <i className="d3">·</i>
    </span>
  )
}

export function Story(): ReactNode {
  return (
    <PublicFrame page="story">
      <a className="skip" href="#outcomes">Skip to the outcomes</a>
      <PublicChrome page="story" />

      <main>
        <section className="band">
          <div className="wrapper split split--hero">
            <div className="side" style={{ position: 'static' }}>
              <span className="eyebrow">Success story · Real estate · Philippines</span>
              <h1>A 9-step manual payables process, read and matched by an agent.</h1>
              <p className="stand">
                A premier Philippine real estate conglomerate ran accounts payable by hand: billing
                countered at a desk, encoded into a weekly spreadsheet, checked, entered into SAP, and
                routed for approval on paper. Volumes were on course to quadruple. The reading was the
                bottleneck, so that is what we pointed the agent at.
              </p>
            </div>
            <div className="main" style={{ marginTop: 0 }}>
              <div className="panel">
                <span className="tag">The client</span>
                <p><b>A premier Philippine real estate conglomerate.</b></p>
                <p className="small">
                  High-rise luxury residential developer, 35+ years of operations, managing properties
                  across Metro Manila and expanding nationwide. Unnamed here under a mutual NDA.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(calc(var(--u)*30),1fr))',
                    gap: 'calc(var(--u)*5)',
                    marginTop: 'calc(var(--u)*5)',
                  }}
                >
                  <Scale value="90" caption="Buildings managed" />
                  <Scale value="3.4M sqm" caption="Gross floor area" />
                  <Scale value="1,000+" caption="Employees" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band band--sheet" id="outcomes">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">What changed</span>
              <h2>Seven minutes a transaction, and the judgement left where it was.</h2>
            </div>
            <div className="main">
              <p>
                Figures below are the client&rsquo;s own, measured against their pre-project baseline and
                agreed for release. Where a number is a projection it says so.
              </p>
              <div
                className="panel"
                data-pick="true"
                style={{ marginTop: 'calc(var(--u)*8)', display: 'flex', gap: 'calc(var(--u)*6)', alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Mascot size="2.5rem" />
                <span style={{ minWidth: 'calc(var(--u)*60)', flex: 1 }}>
                  <b style={{ display: 'block', fontSize: 'var(--s4)' }}>Read by the agent. Decided by the team.</b>
                  <span className="small" style={{ display: 'block', marginTop: 'calc(var(--u)*2)' }}>
                    Every figure below comes from the reading and matching being done by machine. None of
                    them comes from a decision being made by machine — the review step was kept, and the
                    approval authority did not move.
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(calc(var(--u)*44),1fr))',
                  gap: 'calc(var(--u)*6)',
                  marginTop: 'calc(var(--u)*8)',
                }}
              >
                <Figure value="65%" caption="Reduction in AP processing time per transaction" />
                <Figure value="20→7" caption="Minutes per transaction, manual to AI-assisted" />
                <Figure value="727 hrs" caption="Monthly hours saved at projected 2026 volumes, 1,118 → 391" />
                <Figure value="85%+" caption="Document field extraction accuracy achieved" />
                <Figure value="6,000" caption="Transactions a month of tested capacity, 50+ concurrent users" />
                <Figure value="3-way" caption="Automated match across purchase order, goods receipt and invoice" />
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="platform-load">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">The burning platform</span>
              <h2>Volume was the reason, not cost.</h2>
            </div>
            <div className="main">
              <p>
                Transactions were on course to quadruple in two years. At 20 minutes of reading each, the
                pile grows faster than the team can be hired against — which is what makes reconciliation
                the right place to put an agent, and the wrong place to put more people.
              </p>
              <div className="panel" style={{ marginTop: 'calc(var(--u)*8)' }}>
                <span className="tag">Monthly workload · manual vs AI-assisted</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'calc(var(--u)*24) minmax(0,1fr)',
                    gap: 'calc(var(--u)*4) calc(var(--u)*5)',
                    alignItems: 'center',
                  }}
                >
                  <Year year="2024" manual="284 hrs" manualWidth="25%" assisted="99 hrs" assistedWidth="9%" transactions="852" />
                  <Year year="2025" manual="457 hrs" manualWidth="41%" assisted="160 hrs" assistedWidth="14%" transactions="1,372" />
                  <Year year="2026 ~proj" manual="1,118 hrs" manualWidth="100%" assisted="391 hrs" assistedWidth="35%" transactions="3,354" />
                </div>
                <p className="small" style={{ marginTop: 'calc(var(--u)*5)' }}>
                  Bars are scaled against the 2026 manual figure. The tilde on 2026 is deliberate — it is a
                  projection, and every projected number on this page wears one.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="band band--sheet" id="process">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">The process</span>
              <h2>Nine steps became seven, and three of them are still a person.</h2>
            </div>
            <div className="main">
              <p>
                The steps that disappeared are the ones where somebody retyped what a document already
                said. The review step was kept on purpose: exceptions are handled by the team, not by the
                agent.
              </p>
              <div
                className="panel"
                style={{
                  marginTop: 'calc(var(--u)*8)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(calc(var(--u)*52),1fr))',
                  gap: 'calc(var(--u)*8)',
                }}
              >
                <FromTo label="Minutes per transaction" from="20" to="7" />
                <FromTo label="Steps in the process" from="9" to="7" />
                <FromTo label="Steps a person performs" from="9" to="3" />
              </div>
              <div className="cols cols--two" style={{ marginTop: 'calc(var(--u)*5)' }}>
                <div className="panel">
                  <span className="tag">Before · manual payables, 9 steps</span>
                  <Steps items={BEFORE} />
                  <p className="small" style={{ marginTop: 'calc(var(--u)*4)' }}>
                    <b>20 minutes a transaction</b> at the outset, error-prone, and bottlenecked at scale.
                    Nine steps, and a person performs all nine.
                  </p>
                </div>
                <div className="panel" data-pick="true">
                  <span className="tag" style={{ display: 'flex', alignItems: 'center', gap: 'calc(var(--u)*3)' }}>
                    <Mascot size="1.25rem" />
                    After · agentic workflow, 7 steps
                  </span>
                  <Steps items={AFTER} />
                  <p className="small" style={{ marginTop: 'calc(var(--u)*4)' }}>
                    <b>7 minutes a transaction</b>, 85%+ extraction accuracy, tested to 6,000 transactions a
                    month.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="delivery">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">How it was delivered</span>
              <h2>A two-week proof first, because the three-way match had to be shown.</h2>
            </div>
            <div className="main">
              <p>
                Nobody had to take the extraction accuracy on trust. The first two weeks tested it on
                their own documents against a stated floor, and production only started after that
                number was met.
              </p>
              <div className="rail">
                <div><div className="stage"><span className="n">Phase 0 · 2 weeks</span><span className="nm">Proof of concept</span><span className="ds">Three-way match feasibility on real documents, 80% extraction accuracy target, three document triads validated, stakeholder sign-off. June–July 2025.</span></div></div>
                <div><div className="stage"><span className="n">Phase 1</span><span className="nm">Workflow engine</span><span className="ds">Dual-entity disbursement platform, role-based access for vendor, materials and AP, RFP and voucher generation, AWS deployment behind a secure portal. September 2025 onward.</span></div></div>
                <div><div className="stage"><span className="n">Phase 2–3</span><span className="nm">Visibility and scale</span><span className="ds">Management KPI dashboards by department, admin and manager hierarchy, load tested at 6,000 transactions a month and 50+ users. Ongoing 2025–2026.</span></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="band band--sheet" id="learnings">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">What was hard</span>
              <h2>The honest version, including what the agent did not fix.</h2>
            </div>
            <div className="main">
              <p>
                Published because the difficulties are the useful part of a case study. Every one of these
                changed how the product works.
              </p>
              <div className="cols cols--two">
                <div className="panel">
                  <span className="tag">Challenges encountered</span>
                  <ul className="list" style={{ marginTop: 0 }}>
                    {CHALLENGES.map((c) => (
                      <li key={c}><span className="mk">!</span><span>{c}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="panel" data-pick="true">
                  <span className="tag">What we learned</span>
                  <ul className="list" style={{ marginTop: 0 }}>
                    <li><span className="mk">›</span><span>A proof of concept first de-risked the production investment and built confidence before budget was committed.</span></li>
                    <li><span className="mk">›</span><span><b>AI reduced effort per transaction, not operational complexity.</b> Headcount was redeployed, not eliminated, and saying otherwise would have been a false promise.</span></li>
                    <li><span className="mk">›</span><span>Human review at the exception stage is not a transitional measure. It is what makes the throughput safe.</span></li>
                    <li><span className="mk">›</span><span>Phased delivery let scope be refined against feedback instead of guessed at up front.</span></li>
                    <li><span className="mk">›</span><span>Separating vendor, materials and AP access cut error propagation significantly.</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="stack">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">What it runs on</span>
              <h2>Their AWS account, their documents.</h2>
            </div>
            <div className="main">
              <p>
                Deployed on AWS with the document processing on Amazon Bedrock. The portal, the workflow
                engine and the dashboards are ReconcileAI; the account and the keys are the client&rsquo;s.
              </p>
              <div className="slots">
                {STACK.map((s) => (
                  <span key={s} className="slot">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="band band--last" id="demo">
          <div className="wrapper split">
            <div className="side">
              <span className="eyebrow">Start narrow</span>
              <h2>Bring us one exception type.</h2>
            </div>
            <div className="main">
              <p className="stand">
                This engagement started with three document triads and a stated accuracy floor. Yours can
                start the same way.
              </p>
              <div className="acts">
                <a className="btn btn--lg" data-commit href={SITE_PATHS.demo}>Book a demo</a>
                <a className="btn btn--lg" href={`${SITE_PATHS.home}#proof`}>Back to success stories</a>
              </div>
            </div>
          </div>
        </section>

        <PublicFooter
          page="story"
          withPublisher
          disclaimer={
            <>
              Client identity withheld per mutual NDA. Engagement period June 2025 — ongoing. Figures are
              the client&rsquo;s own, measured against their pre-project baseline; 2026 figures are
              projections and are marked as such.
            </>
          }
        />
      </main>
    </PublicFrame>
  )
}
