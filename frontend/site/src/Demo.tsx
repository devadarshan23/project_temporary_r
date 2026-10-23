/**
 * `/demo` — BOOK A DEMO. The pack's `V2 Book a Demo.dc.html`, built. G3071–G3074,
 * 2 Oct 2026.
 *
 * Drawn as the pack draws it: the hero band, the three "what you get" panels,
 * and the two-step form at `#form` — step one is six questions answered by
 * buttons, step two is who you are. The words are the pack's wherever the pack's
 * words are true of this build. Where they are not, this file says so here
 * rather than shipping them:
 *
 * 🛑 G3072 — THE REFERRAL CODE IS NEVER EVALUATED, AND THE PACK'S TWO STATES
 * THAT EVALUATE IT ARE NOT BUILT. The drawing carries an illustrative registry
 * (`MRD-114`, `APX-208`) and renders *"Referral matched to …"* or *"That
 * referral code does not match a registration"* after booking. That is a
 * referral-code ORACLE on a public page — exactly what G2001 closed in the
 * intake, where the same request answers `202 {"status":"received"}` for every
 * code. So this screen renders NOTHING that depends on the code's value: the
 * code is sent as typed, and every outcome below is identical for any code.
 * The match is the staff console's, later (`DEMO_INTAKE_FIELDS`' own note).
 *
 * ⚠️ G3073 — NO PHONE AND NO SLOT PICKER. The intake's field set is CLOSED and
 * REFUSES an unknown field (`intake_unknown_field`), and it has no `phone` and
 * no `slot`; the pack's slots are illustrative (*"A real calendar would come
 * from the scheduling system"*) and its own journey marks *"Book a slot"* as
 * `exists: neither`, `buy · scheduling`. The pack draws the no-slot arm itself —
 * `showSlots: false`, *"we will come back with times"* — and that is the arm
 * built. Adding either field is an intake contract change, not a form edit.
 *
 * ⚠️ G3071 — WHERE THE SUBMIT GOES. `api/intake.ts` argues it: same-origin
 * `/demo/intake`, routed only at the apex. On any other host the form still
 * renders and still sends, and the screen STATES before submission that nothing
 * answers here, and reports a refusal as a refusal afterwards. It never reports
 * a success it did not receive.
 *
 * 🛑 NO `/v1` READ AND NO APP CHROME — `PublicPlane.tsx`.
 *
 * ✅ AND IT IS SERVED FROM THE APEX SINCE 2 Oct 2026 — G3151, THE OWNER'S RULING.
 * This file was `frontend/src/public/Demo.tsx` and moved into the apex site,
 * which is the one host `/demo/intake` is routed at, so the gap G3071 states is
 * closed WHERE THE PAGE IS SERVED and the screen's own gap notice stays for any
 * host that is not the apex (a local run, a preview) — still answered by the
 * response rather than by a guess about the deployment.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import {
  DEMO_INTAKE_FIELD_MAX_LENGTH,
  DEMO_INTAKE_PATH,
  intakeBody,
  intakeRoutedAt,
  sendDemoIntake,
  type DemoIntake,
} from './api/intake.ts'
import { YourMove } from '../../src/components/Grammar.tsx'
import { PublicChrome, PublicFooter, PublicFrame, SITE_PATHS } from './PublicPlane.tsx'

/* The pack's own vocabularies, in the pack's order. */
const DOCTYPES = ['Supplier invoices', 'Purchase orders', 'Goods receipts', 'Bank statements', 'Credit notes', 'Customs and shipping', 'Contracts'] as const
const LANGS = ['English', 'Bahasa Indonesia', 'Bahasa Melayu', 'Mandarin', 'Tagalog', 'Thai', 'Vietnamese', 'Tamil', 'Khmer', 'Burmese', 'Japanese', 'Korean'] as const
const SYSTEMS = ['SAP', 'Oracle', 'NetSuite', 'Microsoft Dynamics', 'Coupa', 'Bank feeds', 'Supplier portal', 'Shared inbox', 'Spreadsheets'] as const
const KINDS = ['Duplicate payments', 'Unaccounted charges', 'FX variance', 'Intercompany', 'Ingestion backlog'] as const
const VOLUMES = ['Under 1,000', '1,000 – 10,000', '10,000 – 100,000', 'More than 100,000'] as const

/**
 * The pack's three answers to *"Where do the documents need to sit?"*, each
 * with the value `ownAwsAccount` carries. That field is capped at twenty
 * characters (`DEMO_INTAKE_FIELD_MAX_LENGTH`), so the label is shown and a
 * short, closed token is sent.
 */
const MODES = [
  { label: 'Hosted by you is fine', sent: 'no' },
  { label: 'In our own AWS account — data never leaves it', sent: 'yes' },
  { label: 'Not decided yet', sent: 'undecided' },
] as const

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/

type Step = 'one' | 'two' | 'sending' | 'accepted' | 'not_delivered'

interface Answers {
  readonly docTypes: readonly string[]
  readonly langs: readonly string[]
  readonly kinds: readonly string[]
  readonly systems: readonly string[]
  readonly volume: number | null
  readonly mode: number | null
  readonly name: string
  readonly email: string
  readonly company: string
  readonly code: string
  readonly what: string
}

const EMPTY: Answers = {
  docTypes: [], langs: [], kinds: [], systems: [], volume: null, mode: null,
  name: '', email: '', company: '', code: '', what: '',
}

/** Step one's answers and the free paragraph, as the one text field the intake has for them. */
export function reconcilingToday(a: Answers): string {
  const lines = [
    a.docTypes.length > 0 ? `Documents: ${a.docTypes.join(', ')}` : null,
    a.langs.length > 0 ? `Languages: ${a.langs.join(', ')}` : null,
    a.kinds.length > 0 ? `Exception types: ${a.kinds.join(', ')}` : null,
    a.systems.length > 0 ? `Systems: ${a.systems.join(', ')}` : null,
    a.what.trim() !== '' ? `Open with: ${a.what.trim()}` : null,
  ]
  return lines.filter((l): l is string => l !== null).join('\n')
}

function intakeOf(a: Answers): DemoIntake {
  const mode = a.mode === null ? undefined : MODES[a.mode]
  const volume = a.volume === null ? undefined : VOLUMES[a.volume]
  return {
    name: a.name,
    email: a.email,
    company: a.company,
    reconcilingToday: reconcilingToday(a),
    ...(volume === undefined ? {} : { volume }),
    ...(mode === undefined ? {} : { ownAwsAccount: mode.sent }),
    referralCode: a.code,
  }
}

function Chips({
  options,
  picked,
  onToggle,
}: {
  readonly options: readonly string[]
  readonly picked: readonly string[]
  readonly onToggle: (value: string) => void
}): ReactNode {
  return (
    <div className="choices">
      {options.map((v) => (
        <button
          key={v}
          className="choice"
          type="button"
          aria-pressed={picked.includes(v)}
          onClick={() => onToggle(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function OneOf({
  options,
  picked,
  onPick,
}: {
  readonly options: readonly string[]
  readonly picked: number | null
  readonly onPick: (index: number) => void
}): ReactNode {
  return (
    <div className="choices">
      {options.map((v, i) => (
        <button key={v} className="choice" type="button" aria-pressed={picked === i} onClick={() => onPick(i)}>
          {v}
        </button>
      ))}
    </div>
  )
}

function plural(n: number, one: string): string {
  return `${String(n)} ${one}${n === 1 ? '' : 's'}`
}

export function Demo(): ReactNode {
  const [a, setA] = useState<Answers>(EMPTY)
  const [step, setStep] = useState<Step>('one')
  const [refusedStatus, setRefusedStatus] = useState<number>(0)
  /* NA-03 (G3716): Send was pressed with something missing — mark what. */
  const [tried, setTried] = useState(false)
  /* NA-01 (G3714): a step change moves the reader to the new step — the
     section into view under the sticky header, and focus to its heading — so
     a keyboard or a phone user does not land mid-form on <body>. The first
     paint moves nothing; `sending` is the same step, still. */
  const form = useRef<HTMLElement | null>(null)
  const painted = useRef(false)
  useEffect(() => {
    if (!painted.current) {
      painted.current = true
      return
    }
    if (step === 'sending') return
    const section = form.current
    if (section === null) return
    const header = document.querySelector<HTMLElement>('.pchrome')
    const top = section.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0)
    window.scrollTo({ top: Math.max(0, top) })
    section.querySelector<HTMLElement>('[data-step-head]')?.focus({ preventScroll: true })
  }, [step])
  /* Read only in step two, which the prerender never reaches — so the server
     render and the first client render agree whatever this answers. */
  const routedHere = typeof window === 'undefined' ? true : intakeRoutedAt(window.location.hostname)

  const toggle = (key: 'docTypes' | 'langs' | 'kinds' | 'systems') => (v: string) =>
    setA((p) => ({ ...p, [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }))
  const set = (key: 'name' | 'email' | 'company' | 'code' | 'what') => (value: string) =>
    setA((p) => ({ ...p, [key]: value }))

  const oneReady = a.docTypes.length > 0 && a.kinds.length > 0
  const answered = [a.docTypes.length, a.langs.length, a.kinds.length, a.systems.length,
    a.volume !== null ? 1 : 0, a.mode !== null ? 1 : 0].filter((n) => n > 0).length
  const contactReady =
    a.name.trim().length > 1 && EMAIL.test(a.email.trim()) && a.company.trim().length > 1
  /* The composed text must fit the intake's cap. It is REFUSED here rather than
     cut, because a truncated paragraph is a request saying less than the person
     wrote, with nothing on screen to say so. */
  const fits = intakeBody(intakeOf(a)) !== null
  const sendReady = contactReady && fits && step === 'two'

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!sendReady) {
      setTried(true)
      return
    }
    setStep('sending')
    const out = await sendDemoIntake(intakeOf(a))
    if (out.kind === 'accepted') {
      setStep('accepted')
    } else {
      setRefusedStatus(out.status)
      setStep('not_delivered')
    }
  }

  /* NA-03 (G3716): which of the three is missing or malformed, by name. */
  const nameBad = a.name.trim().length <= 1
  const emailBad = !EMAIL.test(a.email.trim())
  const companyBad = a.company.trim().length <= 1
  const missing = [
    nameBad ? 'your name' : null,
    emailBad ? (a.email.trim() === '' ? 'a work email' : 'a work email that is an address') : null,
    companyBad ? 'a company' : null,
  ].filter((m): m is string => m !== null)
  /* NA-02 — THE OWNER'S RULING (4 Oct 2026, G3715): *"Switch to 'send': copy
     says 'until you send it', amend V2's two notes; no calendar integration."*
     ⚠️ THIS SAID *"Nothing is stored until you book."* (G3592) beside a button
     that SENDS, on a page that books nothing — false on the page carrying it. */
  const twoNote = !contactReady
    ? tried
      ? <span role="alert"><YourMove>{`Still needed: ${missing.join(', ')}. Nothing is sent until you send it.`}</YourMove></span>
      : <YourMove>Name, a work email and a company. Nothing is sent until you send it.</YourMove>
    : !fits
      ? <YourMove>That is longer than the request can carry. Shorten the paragraph at the end.</YourMove>
      : a.mode === 1
        ? 'Noted: your own AWS account, where your data never leaves your boundary. We will bring the engineer who runs that deployment.'
        : 'Ready to send — we will come back with times.'

  return (
    <PublicFrame page="demo">
      {/* NA-05 (G3717): the skip link is the FIRST Tab stop, as V1–V4 put it —
          it sat after the logo and Sign in. */}
      <a className="skip" href="#form">Skip to the form</a>
      <PublicChrome page="demo" />

      <section className="band">
        <div className="wrapper split split--hero">
          <div className="side" style={{ position: 'static' }}>
            <span className="eyebrow">Book a demo</span>
            <h1>Bring us one exception type.</h1>
            <p className="stand">
              Forty-five minutes, guided end to end on your own use case — not a slide deck — and
              you leave with a bespoke ROI report. Run it in your own AWS account and your documents
              never leave it.
            </p>
          </div>
          <div className="main" style={{ marginTop: 0 }}>
            <p className="small">
              Bring one exception type. We show a document read field by field with a confidence
              each, a field parked below the floor, a match group, an exception with the candidates
              it ruled out, and a proposal stopping at an authority limit — on your documents, not a
              seeded story.
            </p>
            <div className="acts">
              <a className="btn btn--lg" href="#form">Start with your use case</a>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrapper split">
          <div className="side">
            <span className="eyebrow">What you get</span>
            <h2>A guided tour of your own reconciliation, and an ROI report to keep.</h2>
          </div>
          <div
            className="main cols"
            style={{
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,calc(var(--u)*62)),1fr))',
              marginTop: 0,
            }}
          >
            <div className="panel">
              <span className="tag">A guided tour, on your use case</span>
              <p className="small">
                We take the documents, languages, exception types and systems you select below and
                walk the whole path with you — read, match, exception, proposal — narrated by the
                person who would run your deployment.
              </p>
            </div>
            <div className="panel">
              <span className="tag">A bespoke ROI report, free</span>
              <p className="small">
                Your volumes and exception mix costed: hours spent on each exception type today, what
                falls away when the machine does the first pass, and which of your types are not
                reconcilable from the documents you have. Written, yours to circulate, no obligation.
              </p>
            </div>
            <div className="panel" data-pick="true">
              <span className="tag">Your data never leaves your AWS account</span>
              <p className="small">
                Deploy into your own account and the documents, the models and the audit trail stay
                inside your boundary — we hold no copy. Residency, retention and support access stay
                under your control. The hosted tenant is there when you would rather we ran it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="band band--sheet" id="form" data-demo-state={step} ref={form}>
        <div className="wrapper">
          {step === 'one' && (
            <div className="split">
              <div className="side">
                <span className="eyebrow">Step one of two</span>
                <h2 tabIndex={-1} data-step-head>What you are reconciling.</h2>
                <p className="small">
                  Your time is worth more than a generic walkthrough, so we start here: these answers
                  let us tailor the demo to your landscape before you arrive. Every one of them is a
                  button, and you can start from a typical setup and adjust it.
                </p>
              </div>

              <div className="form main">
                <div className="headstart">
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setA((p) => ({
                        ...p,
                        docTypes: ['Supplier invoices', 'Purchase orders', 'Goods receipts'],
                        langs: ['English', 'Bahasa Indonesia', 'Mandarin'],
                        kinds: ['Duplicate payments', 'Unaccounted charges'],
                        systems: ['SAP', 'Bank feeds', 'Spreadsheets'],
                        volume: 1,
                        mode: 0,
                      }))
                    }
                  >
                    Start from a typical setup
                  </button>
                  <span className="small">
                    {answered === 0
                      ? 'One click loads the setup most teams like yours start from — adjust anything.'
                      : answered >= 6
                        ? 'All six answered. Your demo is fully tailored.'
                        : `${String(answered)} of 6 answered — ${String(6 - answered)} to go, and the demo gets sharper with each one.`}
                  </span>
                </div>

                <div className="group">
                  <span className="glab">
                    Your documents{' '}
                    <span className="gnote">
                      {a.docTypes.length > 0
                        ? `${String(a.docTypes.length)} selected · ${a.langs.length > 0 ? plural(a.langs.length, 'language') : 'no languages'}`
                        : 'three questions'}
                    </span>
                  </span>
                  <div className="field full">
                    <span>Which documents do you reconcile?</span>
                    <Chips options={DOCTYPES} picked={a.docTypes} onToggle={toggle('docTypes')} />
                  </div>
                  <div className="field full">
                    <span>
                      Which languages do they arrive in?{' '}
                      <span className="hint">Pick every one you see, including the rare ones.</span>
                    </span>
                    <Chips options={LANGS} picked={a.langs} onToggle={toggle('langs')} />
                  </div>
                  <div className="field full">
                    <span>Roughly how many a month?</span>
                    <OneOf options={VOLUMES} picked={a.volume} onPick={(i) => setA((p) => ({ ...p, volume: i }))} />
                  </div>
                </div>

                <div className="group">
                  <span className="glab">
                    Your exceptions{' '}
                    <span className="gnote">
                      {a.kinds.length > 0
                        ? `${plural(a.kinds.length, 'type')} · ${a.systems.length > 0 ? plural(a.systems.length, 'system') : 'no systems'}`
                        : 'two questions'}
                    </span>
                  </span>
                  <div className="field full">
                    <span>Which exception types hurt most?</span>
                    <Chips options={KINDS} picked={a.kinds} onToggle={toggle('kinds')} />
                  </div>
                  <div className="field full">
                    <span>
                      Which systems hold the evidence?{' '}
                      <span className="hint">Pick the ones you recognise. We will ask about the rest on the call.</span>
                    </span>
                    <Chips options={SYSTEMS} picked={a.systems} onToggle={toggle('systems')} />
                  </div>
                </div>

                <div className="group">
                  <span className="glab">
                    Where it runs <span className="gnote">{a.mode === null ? 'one question' : 'answered'}</span>
                  </span>
                  <div className="field full">
                    <span>
                      Where do the documents need to sit?{' '}
                      <span className="hint">
                        In your own AWS account, nothing ever leaves your boundary. Hosted by us is
                        faster to start. Either way we tailor the session to it.
                      </span>
                    </span>
                    <OneOf
                      options={MODES.map((m) => m.label)}
                      picked={a.mode}
                      onPick={(i) => setA((p) => ({ ...p, mode: i }))}
                    />
                  </div>
                </div>

                <div className="full acts" style={{ marginTop: 0 }}>
                  <button
                    className="btn btn--lg"
                    type="button"
                    data-commit
                    data-demo-continue
                    aria-disabled={!oneReady}
                    onClick={() => { if (oneReady) setStep('two') }}
                  >
                    Continue
                  </button>
                </div>
                <p className="small full" style={{ marginTop: 0 }}>
                  {oneReady
                    ? 'That is enough to build the demo around. Contact details next.'
                    : <YourMove>A document type and an exception type, and we can prepare. Nothing here is sent until you send it.</YourMove>}
                </p>
              </div>
            </div>
          )}

          {(step === 'two' || step === 'sending') && (
            <div className="split">
              <div className="side">
                <span className="eyebrow">Step two of two</span>
                <h2 tabIndex={-1} data-step-head>Who you are.</h2>
                <p className="small">
                  Now that we know what to prepare, three fields. The code and the paragraph at the
                  end are optional, and we come back to you with times.
                </p>
              </div>

              <form className="form main" onSubmit={(e) => void submit(e)} noValidate>
                <label className="field">
                  <span>Your name</span>
                  <input type="text" name="name" autoComplete="name" value={a.name}
                    maxLength={DEMO_INTAKE_FIELD_MAX_LENGTH.name}
                    aria-invalid={tried && nameBad}
                    onChange={(e) => set('name')(e.target.value)} placeholder="Aisyah Rahman" />
                </label>
                <label className="field">
                  <span>Work email</span>
                  <input type="email" name="email" autoComplete="email" value={a.email}
                    maxLength={DEMO_INTAKE_FIELD_MAX_LENGTH.email}
                    aria-invalid={tried && emailBad}
                    onChange={(e) => set('email')(e.target.value)} placeholder="you@company.com" />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input type="text" name="company" autoComplete="organization" value={a.company}
                    maxLength={DEMO_INTAKE_FIELD_MAX_LENGTH.company}
                    aria-invalid={tried && companyBad}
                    onChange={(e) => set('company')(e.target.value)} placeholder="Meridian Group Pte Ltd" />
                </label>
                <label className="field">
                  <span>
                    Referral code{' '}
                    <span className="hint">
                      If a partner introduced us. It goes with your request exactly as you type it;
                      our staff match it to partner registrations later, and this page never checks it.
                    </span>
                  </span>
                  <input type="text" name="referralCode" className="mono" value={a.code}
                    maxLength={DEMO_INTAKE_FIELD_MAX_LENGTH.referralCode}
                    onChange={(e) => set('code')(e.target.value)} placeholder="optional" />
                </label>
                <label className="field full">
                  <span>
                    Anything you want us to open with?{' '}
                    <span className="hint">Optional. Plain words are better than a list of systems.</span>
                  </span>
                  <textarea name="what" value={a.what}
                    onChange={(e) => set('what')(e.target.value)}
                    placeholder="Supplier invoices against goods receipts across two ERPs, monthly, in spreadsheets." />
                </label>

                {!routedHere && (
                  <div className="answer full" data-demo-gap="intake-unrouted">
                    <b>Not connected on this host.</b> This form sends to{' '}
                    <span className="mono">{DEMO_INTAKE_PATH}</span> on the host you are on, and that
                    path is answered only at <span className="mono">reconcileai.app</span>. Here
                    nothing is set up to receive it, so a request sent from this page will be
                    refused — and this page will tell you so rather than claim it went through.
                  </div>
                )}

                <div className="full acts" style={{ marginTop: 0 }}>
                  <button className="btn btn--lg" type="submit" data-commit data-demo-send
                    aria-disabled={!sendReady}>
                    {step === 'sending' ? 'Sending' : 'Send it'}
                  </button>
                  <button className="btn btn--lg" type="button" onClick={() => setStep('one')}>
                    Back
                  </button>
                </div>
                <p className="small full" style={{ marginTop: 0 }}>{twoNote}</p>
              </form>
            </div>
          )}

          {step === 'accepted' && (
            <div className="split">
              <div className="side">
                <span className="eyebrow">Received</span>
                <h2 tabIndex={-1} data-step-head>Your request is in.</h2>
              </div>
              <div className="main">
                <p className="stand">
                  {(a.name.trim().split(' ')[0] ?? '') || 'Thanks'} — forty-five minutes, and we will
                  open with your own exception type rather than ours.
                </p>
                <div className="answer" role="status" style={{ marginTop: 'calc(var(--u) * 8)' }}>
                  <b>What happens now.</b> A person replies with times. The intake gives every request
                  it takes the same answer, so this page knows that yours was taken — and nothing
                  more than that.
                </div>
                <ul className="list">
                  <li>
                    <span className="mk" aria-hidden="true">·</span>
                    <span>
                      <b>Your ROI report follows the call.</b> Your volumes and exception mix costed,
                      and a written view of which types are reconcilable from the documents you
                      already have. Free, yours to circulate, no obligation.
                    </span>
                  </li>
                  <li>
                    <span className="mk" aria-hidden="true">·</span>
                    <span>
                      <b>A referral code, if you gave one, went with it exactly as typed.</b> Our
                      staff match it to partner registrations later. Nothing here checks it, so this
                      page cannot tell you whether it matched.
                    </span>
                  </li>
                </ul>
                <div className="acts">
                  <a className="btn btn--lg" href={SITE_PATHS.home}>Back to the site</a>
                  <button className="btn btn--lg" type="button" onClick={() => { setA(EMPTY); setTried(false); setStep('one') }}>
                    Send another
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'not_delivered' && (
            <div className="split">
              <div className="side">
                <span className="eyebrow">Not sent</span>
                <h2 tabIndex={-1} data-step-head>Your request did not reach us.</h2>
              </div>
              <div className="main">
                {/* NA-06 (G3718): no raw HTTP status in the sentence a prospect
                    reads. The code stays, quiet, in a quote line — as E1 keeps it. */}
                <div className="answer" role="alert">
                  <b>Our intake did not accept it.</b> Nothing was received;{' '}
                  {routedHere
                    ? 'try again in a moment.'
                    : 'the host you are on does not route the demo intake, which is the gap stated on the form.'}
                </div>
                <p className="small" style={{ color: 'var(--muted)', marginTop: 'calc(var(--u) * 3)' }} data-demo-quote>
                  If it keeps happening, quote <span className="mono">{refusedStatus === 0 ? 'no answer' : String(refusedStatus)}</span>.
                </p>
                <div className="acts">
                  <button className="btn btn--lg" type="button" data-commit onClick={() => setStep('two')}>
                    Back to your answers
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <PublicFooter page="demo" withPublisher={false} />
    </PublicFrame>
  )
}
