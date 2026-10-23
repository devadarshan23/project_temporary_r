import { useEffect, useState, type FormEvent } from 'react'

import {
  fetchParkedPane,
  fetchParkedPile,
  raiseParked,
  type ParkedEscalation,
  type ParkedPane as Pane,
  type ParkedPile as Pile,
} from '../api/parked.ts'
import { PlaneRefused } from '../api/runs.ts'
import { documentTypeName, documentTypeReference, fetchDocumentTypes, type DocumentTypeChoice } from '../api/sources.ts'
import { DRAW_GATES, useHolds } from '../capabilities.ts'
import { whenOf } from '../format.ts'
import {
  NO_FILENAME,
  PARKED_BECAUSE_SHORT,
  PARKED_BECAUSE_WORD,
  deliveriesOf,
  pairSeedOf,
  pileIsDrawn,
  pileSummary,
  unblockerOf,
  type PairSeed,
} from '../parked.ts'

/**
 * C9 · THE PARKED PILE ON THE REGISTER — rows 18 and 19, feat/ui-parked-pile
 * (G3501–G3510, 3 Oct 2026). The wire was built by G2831–G2840; until this file
 * the frontend drew no line and no pane.
 *
 * ┌─ 🛑 COUNTED APART FROM EXCEPTIONS ─────────────────────────────────────────┐
 * │ Row 18: *"counted apart from exceptions so the denominator stays honest"*. │
 * │ This is its own section, reading its own operation (`listParkedArrivals`), │
 * │ and it feeds NO count the register's facets, the greeting or the chrome   │
 * │ draw. A parked delivery is not a line of the register.                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT IS NOT THE PACK'S "Parked" SHOW FACET, AND THAT IS READ OFF THE PACK.
 * `C1 Close.dc.html`'s `FACETS` selects `r.kind === 'parked'` — a register LINE
 * whose FIELDS fell below the confidence floor (`ref:'04'`, *"Two fields fell
 * below the floor and were parked"*). A parked DELIVERY is a different object:
 * unclassified, held unextracted, never read field by field. Wiring the facet
 * to this pile would put deliveries back into the denominator row 18 keeps them
 * out of. The facet stays as the pack and G3091 draw it (G3503).
 *
 * ┌─ 🛑 INVARIANT 6 AND G106 ──────────────────────────────────────────────────┐
 * │ `filename`, `endpointLabel` and the sample's KEYS are counterparty text.   │
 * │ Each is a React TEXT CHILD — never `dangerouslySetInnerHTML`, never an    │
 * │ `href`, a `style` or a handler built out of one. No VALUE of a held        │
 * │ artefact reaches this file: the plane publishes keys alone and           │
 * │ `api/parked.ts` copies the sample by name.                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE RAISE IS OMITTED, NOT REFUSED, FOR A SESSION THE GATE WOULD REFUSE
 * (G3193's shape). A session without `configure_endpoint` sees the pane — row
 * 19, *"An user who cannot act still follows it"* — and no control it cannot
 * use.
 * ⚠️ AND THE QUESTION IS NO LONGER PUT TO THE GATE BY A PROBE — G3781,
 * 4 Oct 2026. This said *"`mayRaiseParked()` asks the plane's own gate
 * first"*: an empty-body POST per opened pane, read as 403 = no and 400 = yes
 * (G3504/G3505), because nothing the client held named a capability. The
 * session's own list does now (`getSessionPrincipal.capabilities`, G3521, the
 * owner's G3664), so the raise is drawn on `useHolds(DRAW_GATES.raiseParked)`
 * and the probe is DELETED. 🛑 THE 403 IS STILL HANDLED — the list is
 * advisory and stale the moment an assignment is revoked, so a real raise
 * that meets a 403 removes the control (`capabilities.ts`'s backstop rule).
 *
 * ┌─ BOTH PLACES — row 18, G3782, 4 Oct 2026 ─────────────────────────────────┐
 * │ *"Where the parked pile shows: Both places."* The register draws it        │
 * │ (`place="register"`), and so does Setup (`place="setup"`), where the      │
 * │ person who can drain it works. ONE component, ONE reader — Setup imports │
 * │ this file rather than a second copy of the pile. On Setup the pane also  │
 * │ offers "Declare a pairing" (`onDeclarePairing`), which opens Setup's own │
 * │ pair form for that delivery's source, seeded from the delivery           │
 * │ (`pairSeedOf()`), so the drain (G2837) is one step away. It is drawn     │
 * │ only where the caller offers it AND the session holds                   │
 * │ `configure_endpoint` — never on the register, which owns no pair form.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NAMES, NEVER IDS — C3-15, G3943, 4 Oct 2026 ─────────────────────────────┐
 * │ The picker, the escalation line and the drain line each named a document │
 * │ type by its `dt_…` id, because nothing served its label. They now join   │
 * │ to `listDocumentTypes` (G3941) and say `documentTypeName()` — the pack's │
 * │ label, or a neutral word, NEVER the id. The picker offers EVERY type the │
 * │ tenant has rather than only those already paired to this source, which  │
 * │ is the case a parked delivery most often is: a kind nobody paired yet.   │
 * │ Setup hands its own list down (`documentTypes`); the register reads one. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `data-surface="parked-pile"`, `data-parked`, `data-parked-pane`,
 * `data-parked-key`, `data-raise` and `data-escalation` are the subjects the
 * browser suite reads.
 */

type PileLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly pile: Pile }
  /** 401/403 — the line is not this role's, and is omitted (the intake strip's rule). */
  | { readonly phase: 'hidden' }
  | { readonly phase: 'failed' }

type PaneLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'read'; readonly pane: Pane }
  /** 404 — it is no longer parked: a drain extracted it, so the line that linked here is gone. */
  | { readonly phase: 'gone' }
  | { readonly phase: 'failed' }

/** What Setup hands the pane when a parked delivery's pairing is declared from it. */
export interface PairingRequest {
  readonly endpointId: string
  readonly arrivalId: string
  readonly seed: PairSeed
}

export interface ParkedPileProps {
  readonly origin: string
  /** Which of row 18's two places this is. The register is the default. */
  readonly place?: 'register' | 'setup'
  /**
   * Setup only — open the pair form for this delivery's source. Offered per
   * line only where `offersPairing(endpointId)` is true (the source is one
   * Setup has read) and the session holds `configure_endpoint`.
   */
  readonly onDeclarePairing?: (r: PairingRequest) => void
  readonly offersPairing?: (endpointId: string) => boolean
  /** Bumped by the caller to re-read the pile — Setup, after a pair drains it. */
  readonly epoch?: number
  /**
   * G3943 — the tenant's document types, when the caller has already read them
   * (Setup). Absent, the pile reads its own; `null` means the read failed and
   * every type is named by the neutral word.
   */
  readonly documentTypes?: readonly DocumentTypeChoice[] | null
}

/**
 * The names a surface joins `documentTypeId` to (G3943). `undefined` while
 * reading; `null` when the read failed, so `documentTypeName()` answers the
 * neutral word rather than an id.
 */
function useDocumentTypes(
  origin: string,
  given: readonly DocumentTypeChoice[] | null | undefined,
): readonly DocumentTypeChoice[] | null | undefined {
  const [own, setOwn] = useState<readonly DocumentTypeChoice[] | null | undefined>(undefined)
  const needed = given === undefined
  useEffect(() => {
    if (!needed) return
    let live = true
    fetchDocumentTypes({ origin })
      .then((t) => { if (live) setOwn(t) })
      .catch(() => { if (live) setOwn(null) })
    return () => { live = false }
  }, [origin, needed])
  return needed ? own : given
}

export function ParkedPile({
  origin,
  place = 'register',
  onDeclarePairing,
  offersPairing,
  epoch: outer = 0,
  documentTypes: given,
}: ParkedPileProps) {
  const read = useDocumentTypes(origin, given)
  const types = read ?? null
  const [load, setLoad] = useState<PileLoad>({ phase: 'reading' })
  const [open, setOpen] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)
  const label = place === 'setup' ? 'Parked deliveries' : 'Awaiting setup'

  useEffect(() => {
    let live = true
    fetchParkedPile({ origin })
      .then((pile) => { if (live) setLoad({ phase: 'read', pile }) })
      .catch((err: unknown) => {
        if (!live) return
        const hidden = err instanceof PlaneRefused && (err.status === 401 || err.status === 403)
        setLoad(hidden ? { phase: 'hidden' } : { phase: 'failed' })
      })
    return () => { live = false }
  }, [origin, epoch, outer])

  /* Drawn once BOTH reads settle (G3943), so no line flashes a neutral word for a
     type whose name is still on its way. A failed names read is `null`, not this. */
  if (load.phase === 'hidden' || load.phase === 'reading' || read === undefined) return null
  if (load.phase === 'failed') {
    return (
      <section className="parked" data-surface="parked-pile" data-place={place} data-parked-state="failed" aria-label={label}>
        <span className="lab">{label}</span>
        <p className="parked-sum">The parked deliveries could not be read. Reload the page to try again.</p>
      </section>
    )
  }
  const { pile } = load
  if (!pileIsDrawn(pile)) return null

  return (
    <section className="parked" data-surface="parked-pile" data-place={place} data-parked-state="read" aria-label={label}>
      <span className="lab">{label}</span>
      <p className="parked-sum" data-parked-count={pile.awaitingSetup.parked}>
        {pileSummary(pile)}
        <span className="q"> · counted apart from the register's lines</span>
      </p>
      {place === 'setup' ? (
        <p className="q">
          Each waits for a pair on its source rather than being guessed into a type. Declaring a
          pair extracts every delivery it matches.
        </p>
      ) : null}
      {pile.items.length === 0 ? null : (
        <ul className="parked-lines">
          {pile.items.map((item) => {
            const isOpen = open === item.arrivalId
            return (
              <li key={item.arrivalId}>
                <button
                  type="button"
                  className="parked-line"
                  data-parked={item.arrivalId}
                  aria-expanded={isOpen}
                  onClick={() => { setOpen(isOpen ? null : item.arrivalId) }}
                >
                  <span className="fn">{item.filename ?? NO_FILENAME}</span>
                  <span className="src">{item.endpointLabel}</span>
                  <span className="why">
                    {item.escalation === null ? PARKED_BECAUSE_SHORT[item.parkedBecause] : 'raised with the 1CloudHub FDE'}
                  </span>
                  <span className="when">{whenOf(item.arrivedAt)}</span>
                </button>
                {isOpen ? (
                  <ParkedPane
                    origin={origin}
                    arrivalId={item.arrivalId}
                    types={types}
                    onRaised={() => { setEpoch((e) => e + 1) }}
                    {...(onDeclarePairing !== undefined && (offersPairing?.(item.endpointId) ?? false)
                      ? { onDeclarePairing }
                      : {})}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {pile.drains.length === 0 ? null : (
        <ul className="parked-drains">
          {pile.drains.map((d) => (
            <li key={d.pairId} data-drain={d.pairId}>
              {deliveriesOf(d.drained)} extracted from the pile when a pair for{' '}
              <span data-drain-type={d.documentTypeId}>{documentTypeName(types, d.documentTypeId)}</span> was
              declared · {whenOf(d.lastDrainedAt)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface ParkedPaneProps {
  readonly origin: string
  readonly arrivalId: string
  /** G3943 — what each document type is called; `null` names every one neutrally. */
  readonly types: readonly DocumentTypeChoice[] | null
  readonly onRaised: () => void
  /** Setup only (G3782) — see `ParkedPileProps.onDeclarePairing`. */
  readonly onDeclarePairing?: (r: PairingRequest) => void
}

/** Row 19 — one pane about that delivery only: the sample, why it is parked, who unblocks it. */
export function ParkedPane({ origin, arrivalId, types, onRaised, onDeclarePairing }: ParkedPaneProps) {
  const mayPair = useHolds(DRAW_GATES.declarePairing)
  const [load, setLoad] = useState<PaneLoad>({ phase: 'reading' })
  const [escalation, setEscalation] = useState<ParkedEscalation | null>(null)

  useEffect(() => {
    let live = true
    setLoad({ phase: 'reading' })
    fetchParkedPane({ origin, arrivalId })
      .then((pane) => {
        if (!live) return
        setLoad({ phase: 'read', pane })
        setEscalation(pane.escalation)
      })
      .catch((err: unknown) => {
        if (!live) return
        setLoad(err instanceof PlaneRefused && err.status === 404 ? { phase: 'gone' } : { phase: 'failed' })
      })
    return () => { live = false }
  }, [origin, arrivalId])

  if (load.phase === 'reading') {
    return <div className="parked-pane" data-parked-pane={arrivalId} aria-busy="true" />
  }
  if (load.phase !== 'read') {
    return (
      <div className="parked-pane" data-parked-pane={arrivalId} data-pane-state={load.phase}>
        <p>
          {load.phase === 'gone'
            ? 'This delivery is no longer parked — a pair claimed it and it was extracted.'
            : 'This delivery could not be read. Reload the page to try again.'}
        </p>
      </div>
    )
  }
  const { pane } = load
  return (
    <div className="parked-pane" data-parked-pane={arrivalId} data-pane-state="read" role="region" aria-label="Parked delivery">
      <dl className="parked-facts">
        <div>
          <dt>File</dt>
          <dd className="mono" data-parked-filename="">{pane.filename ?? NO_FILENAME}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{pane.endpointLabel}</dd>
        </div>
        <div>
          <dt>Arrived</dt>
          <dd className="mono">{whenOf(pane.arrivedAt)}</dd>
        </div>
        <div>
          <dt>Why it is parked</dt>
          <dd data-parked-because={pane.parkedBecause}>{PARKED_BECAUSE_WORD[pane.parkedBecause]}</dd>
        </div>
        <div>
          <dt>Who unblocks it</dt>
          <dd data-unblocked-by={pane.unblockedBy.capability}>{unblockerOf(pane.unblockedBy.capability)}</dd>
        </div>
      </dl>

      <div className="parked-sample">
        <span className="lab">The sample — its fields, never their values</span>
        {!pane.sample.isRecord ? (
          <p data-sample="not-a-record">It is not a record, so no field mapping can apply to it.</p>
        ) : pane.sample.fields.length === 0 ? (
          <p data-sample="empty">A record with no fields.</p>
        ) : (
          <ul className="parked-keys" data-sample="keys">
            {pane.sample.fields.map((k) => (
              <li key={k} className="mono" data-parked-key="">{k}</li>
            ))}
          </ul>
        )}
        <p className="q">Held unextracted since it arrived. Nothing on this page reads a value out of it.</p>
      </div>

      {/* G3782 — Setup's half of row 18. Omitted, not refused (G3193): no
          caller offer, no `configure_endpoint`, or a sample no mapping can
          apply to, and nothing is drawn. */}
      {onDeclarePairing !== undefined && mayPair && pane.sample.isRecord ? (
        <div className="acts" data-pairing-offer="">
          <button
            type="button"
            className="abtn"
            data-declare-pairing={arrivalId}
            onClick={() => {
              onDeclarePairing({
                endpointId: pane.endpointId,
                arrivalId,
                seed: pairSeedOf(pane.filename, pane.sample.fields),
              })
            }}
          >
            Declare a pairing for it
          </button>
        </div>
      ) : null}

      {escalation === null ? (
        <Raise
          origin={origin}
          arrivalId={arrivalId}
          types={types}
          onRaised={(e) => {
            setEscalation(e)
            onRaised()
          }}
        />
      ) : (
        <p className="result" role="status" data-escalation={escalation.documentTypeId}>
          {/* C3-15/C3-31 (G3852) — no raw type id; the pack names the 1CloudHub FDE.
              G3943 — the type it was raised as is named by its LABEL. */}
          Raised with the 1CloudHub FDE as {documentTypeName(types, escalation.documentTypeId)} ·{' '}
          {whenOf(escalation.raisedAt)}. It stays parked until the pair is declared.
        </p>
      )}
    </div>
  )
}

interface RaiseProps {
  readonly origin: string
  readonly arrivalId: string
  readonly types: readonly DocumentTypeChoice[] | null
  readonly onRaised: (e: ParkedEscalation) => void
}

/**
 * Row 13 — raising it with the FDE, carrying the sample and the type. Drawn
 * only where the session's published list holds `configure_endpoint`
 * (`useHolds`, G3781); a 403 on a real raise removes it (the backstop).
 */
function Raise({ origin, arrivalId, types, onRaised }: RaiseProps) {
  const holdsRaise = useHolds(DRAW_GATES.raiseParked)
  /** The backstop: the gate refused a real raise, so the list was stale. */
  const [refused, setRefused] = useState(false)
  const may = holdsRaise && !refused
  const [documentTypeId, setDocumentTypeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)

  if (!may) return null

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (documentTypeId === '' || busy) return
    setBusy(true)
    setSaid(null)
    raiseParked({ origin, arrivalId, documentTypeId })
      .then((esc) => { onRaised(esc) })
      .catch((err: unknown) => {
        if (err instanceof PlaneRefused && err.status === 403) {
          setRefused(true)
          return
        }
        setSaid(
          err instanceof PlaneRefused && err.status === 422
            ? 'That document type is no longer declared in this tenant.'
            : 'It could not be raised. Nothing was changed.',
        )
      })
      .finally(() => { setBusy(false) })
  }

  /* G3943 — a PICK LIST of every type the tenant has, by label. The typed
     field is gone: the plane refuses any id that is not one of these, so a
     free-text id offered a person nothing but a way to be refused. */
  return (
    <form className="parked-raise" data-raise="" onSubmit={submit}>
      <span className="lab">Raise it with the 1CloudHub FDE</span>
      {types === null ? (
        <p className="q" data-types-state="failed">
          The document types could not be read. Reload the page to try again.
        </p>
      ) : types.length === 0 ? (
        <p className="q" data-types-state="none">
          No document type is declared in this tenant yet, so there is nothing to raise it as.
        </p>
      ) : (
        <p className="q">The document type it should be:</p>
      )}
      {types === null || types.length === 0 ? null : (
        <div className="fac" role="group" aria-label="The document type it should be">
          {types.map((t) => {
            /* U-28 · G4175 — the reference, only where the label does not
               tell this type apart (`documentTypeReference()`). */
            const ref = documentTypeReference(types, t.documentTypeId)
            return (
              <button
                key={t.documentTypeId}
                type="button"
                className="choice"
                data-document-type-choice={t.documentTypeId}
                aria-pressed={documentTypeId === t.documentTypeId}
                onClick={() => { setDocumentTypeId(t.documentTypeId) }}
              >
                <span>{documentTypeName(types, t.documentTypeId)}</span>
                {ref === null ? null : <span className="ref" data-document-type-ref>reference {ref}</span>}
              </button>
            )
          })}
        </div>
      )}
      <div className="acts">
        <button type="submit" className="abtn" data-commit="" aria-disabled={documentTypeId === '' || busy}>
          Raise with the 1CloudHub FDE
        </button>
      </div>
      {said === null ? null : <p className="result" role="status">{said}</p>}
    </form>
  )
}
