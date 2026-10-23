/**
 * C9 · CONFIGURE SOURCES — the Setup surface, drawn from
 * `docs/handoff-pack/C1 Close.dc.html`'s `showSetup` pane ("Sources and
 * packs") and wired to the six served endpoint operations. G2871–G2880,
 * 2 Oct 2026.
 *
 * ┌─ WHAT IS DRAWN AND OPERABLE, AND WHAT IS DRAWN AND REFUSED ───────────────┐
 * │ OPERABLE — list sources · declare one (SFTP or S3) · stop and resume it,  │
 * │ dated · pair a pattern with a document type and map its fields · bind or  │
 * │ rotate its credential.                                                    │
 * │ HATCHED, EACH NAMING THE DECISION THAT REFUSED IT — email and SAP (R16,   │
 * │ G2442) · "whose documents" (the declaration admits no entity, G2872) ·    │
 * │ the connection test (an outbound connection from a request path, G2151) │
 * │ · installing a pack (`installPack` is declared and not mounted, G200).    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 ROW #22 — THE NAV IS NOT GATED BY CAPABILITY, AND THAT IS G2871 RATHER
 * THAN AN OMISSION. No served operation tells a client what its session may do:
 * `TenantContext` carries four keys and none is a capability, and
 * `resolveMembership`'s own `roleId` docblock says *"A client must not infer
 * what this user may do from this id; ask F3."* Inventing a capability read
 * would be a contract change this slice may not make, and PROBING an operation
 * to hide the door would be inferring authority from a side channel. So the
 * door is drawn for everyone and this surface renders the plane's 403 as a
 * REFUSED state — hatched, because the hatch means refused (G245). The pack
 * itself says the same thing in its own voice: *"The nav is not yet gated that
 * way … which is a defect in the surface rather than a change to the rule."*
 *
 * ⚠️ "HATCHED" WENT FALSE ON 2 Oct 2026 — G3194. The owner's quiet ruling
 * G3091 (*"no hatch, no G-numbers … Engineering rationale stays in docs/tests,
 * never on screen"*) SUPERSEDES G245's on-screen hatch for product surfaces,
 * and G3100 named this state as one #531 left. The 403 is now one muted
 * sentence that says who Setup is for; it names no capability and no G row.
 * The refusal is still the PLANE's 403 and still drawn rather than hidden —
 * what moved is the ink, not the honesty. The OTHER hatches in this file
 * (R16's email and SAP, G2872, G2151, G200) are rulings drawn on a reachable
 * surface and are NOT swept here; they are named in G3194.
 *
 * 🛑 AND THEY ARE SWEPT NOW — G3193, THE OWNER'S RULING OF 2 Oct 2026: *"Hide
 * refused items: controls refused by a ruling … are omitted; only
 * genuinely-planned unbuilt items show 'Coming soon'."* R16's EMAIL and SAP
 * (G2442) are the one pair here refused BY A RULING, so they are OMITTED — not
 * drawn, not hatched. "Whose documents" (G2872, a contract gap), the
 * connection test (G2151, a ruling nobody has TAKEN — an absence pending a
 * decision, not a decision) and installing a pack (G200, declared and not
 * mounted) are unbuilt work and are now quiet `<Soon>` controls (G3260). The
 * hatch is gone from this file entirely.
 *
 * ┌─ C9 ROW 18's OTHER HALF — THE PARKED PILE IS DRAWN HERE TOO (G3782) ─────┐
 * │ *"Where the parked pile shows: Both places."* The register drew it (G3501) │
 * │ and Setup did not. It is the SAME `ParkedPile` component reading the SAME │
 * │ operation — no second reader — with `place="setup"`, below the sources,  │
 * │ apart from any exception count. Its pane offers "Declare a pairing for   │
 * │ it", which opens THIS file's pair form for that delivery's source,        │
 * │ seeded from the delivery (`pairSeedOf()`): the drain (G2837) is the 201  │
 * │ of `declareEndpointDocumentType`, one step away. Omitted unless the      │
 * │ session holds `configure_endpoint` and the source is one read here; the  │
 * │ plane's 403 is still the backstop. After a pair, the pile re-reads.      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE CREDENTIAL IS NEVER HELD IN STATE AND NEVER RENDERED. The input is
 * UNCONTROLLED — a controlled React input mirrors its value into the DOM's
 * `value` ATTRIBUTE — read once through a ref at submit and cleared before the
 * answer is drawn. `tests/e2e/browser-login.test.ts` §25d asserts the value
 * appears in no response body and nowhere in the DOM after the bind.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Soon } from './Soon.tsx'
import { ParkedPile, type PairingRequest } from './ParkedPile.tsx'
import type { PairSeed } from '../parked.ts'
import { PlaneRefused } from '../api/runs.ts'
import {
  bindCredential,
  declarePair,
  declareSource,
  documentTypeName,
  documentTypeReference,
  fetchDocumentTypes,
  fetchSources,
  resumeSource,
  stopSource,
  type ConnectionDeclaration,
  type DocumentTypeChoice,
  type MatchKind,
  type PublishedConnection,
  type Source,
  type SourceState,
} from '../api/sources.ts'
import { fieldPathKey, parseFieldPath } from '../../../model/field-path.ts'

export type SourcesLoad =
  | { readonly phase: 'reading' }
  | { readonly phase: 'no-session' }
  | { readonly phase: 'forbidden' }
  | { readonly phase: 'refused'; readonly why: string }
  | { readonly phase: 'read'; readonly sources: readonly Source[] }

/** Total over the contract's four states, so a fifth is a compile error here. */
const STATE_WORDS: Readonly<Record<SourceState, string>> = {
  waiting_on_credential: 'Waiting on a credential',
  waiting_on_first_delivery: 'Credential bound, nothing delivered yet',
  delivered: 'Delivering',
  stopped: 'Stopped',
}

/** A timestamp as the plane sent it, to the minute, in UTC — never re-zoned. */
function stamp(iso: string): string {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

function whereOf(c: PublishedConnection): string {
  return c.kind === 'sftp'
    ? `${c.host}:${String(c.port)} ${c.path}`
    : `s3://${c.bucket}/${c.keyPrefix} (${c.region})`
}

/** What a failed act says. A 403 is a REFUSAL by the gate and is named as one. */
function failureText(err: unknown): string {
  if (err instanceof PlaneRefused) {
    if (err.status === 403) return 'Refused — your role does not allow this. Ask your tenant administrator.'
    if (err.status === 401) return 'You are not signed in. Sign in again, then retry.'
    if (err.refusalKind !== undefined) return `Not accepted: ${err.refusalKind.replace(/_/g, ' ')}.`
    return 'That did not go through. Try again in a moment.'
  }
  return 'That did not go through. Try again in a moment.'
}

function loadFrom(err: unknown): SourcesLoad {
  if (err instanceof PlaneRefused && err.status === 401) return { phase: 'no-session' }
  if (err instanceof PlaneRefused && err.status === 403) return { phase: 'forbidden' }
  return { phase: 'refused', why: err instanceof Error ? err.message : 'unreachable' }
}

function Field(props: {
  readonly label: string
  readonly name: string
  readonly value: string
  readonly onChange: (v: string) => void
  readonly type?: 'text' | 'number'
}): ReactNode {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => { props.onChange(e.currentTarget.value) }}
      />
    </label>
  )
}

/**
 * U-26 · G4171 — the line a form opens with now that it is not in its row: the
 * act, and the source it acts on, by the source's own label (text, never
 * markup). Out of the row, a form that did not say whose it was would be a
 * form about nothing in particular.
 */
function ActHead(props: { readonly verb: string; readonly source: Source }): ReactNode {
  return (
    <span className="lab">
      {props.verb} · <span data-act-form-source={props.source.endpointId}>{props.source.label}</span>
    </span>
  )
}

/**
 * A document type as a choice says it: its NAME (G3943), and — only when that
 * name does not tell it apart from another type on the list — its reference
 * beside it (U-28, G4175; `documentTypeReference()` argues the amendment).
 */
function DocumentTypeWords(props: {
  readonly types: readonly DocumentTypeChoice[] | null
  readonly documentTypeId: string
}): ReactNode {
  const ref = documentTypeReference(props.types, props.documentTypeId)
  return (
    <>
      <span>{documentTypeName(props.types, props.documentTypeId)}</span>
      {ref === null ? null : <span className="ref" data-document-type-ref>reference {ref}</span>}
    </>
  )
}

type Kind = 'sftp' | 's3'

interface Draft {
  readonly label: string
  readonly host: string
  readonly port: string
  readonly path: string
  readonly hostKeyFingerprint: string
  readonly bucket: string
  readonly keyPrefix: string
  readonly region: string
  readonly roleArn: string
}

const EMPTY_DRAFT: Draft = {
  label: '',
  host: '',
  port: '22',
  path: '',
  hostKeyFingerprint: '',
  bucket: '',
  keyPrefix: '',
  region: '',
  roleArn: '',
}

function connectionFrom(kind: Kind, d: Draft): ConnectionDeclaration {
  return kind === 'sftp'
    ? {
        kind: 'sftp',
        host: d.host.trim(),
        port: Number(d.port),
        path: d.path.trim(),
        hostKeyFingerprint: d.hostKeyFingerprint.trim(),
      }
    : {
        kind: 's3',
        bucket: d.bucket.trim(),
        keyPrefix: d.keyPrefix,
        region: d.region.trim(),
        roleArn: d.roleArn.trim(),
      }
}

function DeclareForm(props: {
  readonly onDeclared: (s: Source) => void
  readonly origin: string
  readonly onCancel: () => void
}): ReactNode {
  const [kind, setKind] = useState<Kind | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof Draft) => (v: string): void => { setDraft((d) => ({ ...d, [key]: v })) }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (kind === null || busy) return
    setBusy(true)
    declareSource({ origin: props.origin, label: draft.label, connection: connectionFrom(kind, draft) })
      .then((s) => {
        setResult(null)
        setDraft(EMPTY_DRAFT)
        setKind(null)
        props.onDeclared(s)
      })
      .catch((err: unknown) => { setResult(failureText(err)) })
      .finally(() => { setBusy(false) })
  }

  return (
    <form className="reasons" data-declare-form onSubmit={submit}>
      <span className="lab">How it arrives</span>
      <div className="choices">
        {(
          [
            ['sftp', 'SFTP', 'host, path and a pinned host key'],
            ['s3', 'S3', 'a bucket, a prefix and a role we assume'],
          ] as const
        ).map(([k, label, meta]) => (
          <button
            key={k}
            className="choice"
            type="button"
            data-kind={k}
            aria-pressed={kind === k}
            onClick={() => { setKind(k) }}
          >
            <span>{label}</span>
            <span className="to">{meta}</span>
          </button>
        ))}
      </div>
      {/* G3193 (THE OWNER'S): R16's email and SAP are REFUSED by a ruling
          (G2442), so they are omitted rather than drawn as "Coming soon".
          "Whose documents" is unbuilt work — the contract admits no entity
          yet (G2872) — so it is a quiet `<Soon>` (G3091, G3260). */}
      <Soon className="choice">Whose documents</Soon>

      {kind === null ? null : (
        <div className="fields" data-connection-kind={kind}>
          <Field label="Label" name="label" value={draft.label} onChange={set('label')} />
          {kind === 'sftp' ? (
            <>
              <Field label="Host" name="host" value={draft.host} onChange={set('host')} />
              <Field label="Port" name="port" type="number" value={draft.port} onChange={set('port')} />
              <Field label="Path" name="path" value={draft.path} onChange={set('path')} />
              <Field
                label="Pinned host key (SHA256: and 43 base64 characters)"
                name="hostKeyFingerprint"
                value={draft.hostKeyFingerprint}
                onChange={set('hostKeyFingerprint')}
              />
            </>
          ) : (
            <>
              <Field label="Bucket" name="bucket" value={draft.bucket} onChange={set('bucket')} />
              <Field label="Key prefix" name="keyPrefix" value={draft.keyPrefix} onChange={set('keyPrefix')} />
              <Field label="Region" name="region" value={draft.region} onChange={set('region')} />
              <Field label="Role to assume (ARN)" name="roleArn" value={draft.roleArn} onChange={set('roleArn')} />
            </>
          )}
        </div>
      )}

      {/* Unbuilt, not refused: request-path egress awaits a ruling nobody has
          taken (G2151), which is an absence pending a decision rather than a
          decision — so it is a `<Soon>` under G3193 (G3260). */}
      <Soon className="abtn">Test the connection before declaring</Soon>

      <div className="acts">
        <button className="abtn" type="submit" data-commit aria-disabled={kind === null || busy}>
          Declare it
        </button>
        <button className="abtn" type="button" onClick={props.onCancel}>Cancel</button>
      </div>
      {result === null ? null : <p className="failed" role="status" data-declare-result>{result}</p>}
    </form>
  )
}

/**
 * Bind or rotate. 🛑 UNCONTROLLED, SEE THE HEADER — the value lives in the
 * input element's PROPERTY until submit, is read once, and is cleared.
 */
function BindForm(props: {
  readonly source: Source
  readonly origin: string
  readonly onBound: () => void
  readonly onCancel: () => void
}): ReactNode {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const el = input.current
    if (el === null || busy) return
    const secretValue = el.value
    el.value = ''
    if (secretValue === '') {
      setResult('Nothing was sent — the credential is empty.')
      return
    }
    setBusy(true)
    bindCredential({ origin: props.origin, endpointId: props.source.endpointId, secretValue })
      .then((bound) => {
        setResult(`${bound.rotated ? 'Rotated' : 'Bound'} at ${stamp(bound.boundAt)}. It cannot be read back from here.`)
        props.onBound()
      })
      .catch((err: unknown) => { setResult(failureText(err)) })
      .finally(() => { setBusy(false) })
  }

  return (
    <form className="reasons" data-act-form="bind" data-bind-form={props.source.endpointId} onSubmit={submit}>
      <ActHead verb={props.source.credentialBoundAt === null ? 'Bind a credential' : 'Rotate the credential'} source={props.source} />
      <label className="field">
        <span>
          {props.source.credentialBoundAt === null ? 'Credential' : 'Replace the credential (rotates it)'}
        </span>
        <input ref={input} name="secretValue" type="password" autoComplete="new-password" spellCheck={false} />
      </label>
      <p className="q">
        Held in Secrets Manager under this tenant&rsquo;s own key. Nothing that serves a page can
        read it back, so a wrong credential and an unreachable host look identical from here.
      </p>
      <div className="acts">
        <button className="abtn" type="submit" data-commit aria-disabled={busy}>Bind it</button>
        <button className="abtn" type="button" data-act-cancel onClick={props.onCancel}>Cancel</button>
      </div>
      {result === null ? null : <p className="result" role="status" data-bind-result>{result}</p>}
    </form>
  )
}

interface MappingRow {
  readonly key: number
  readonly sourceField: string
  readonly typeField: string
}

/**
 * Turn the operator's typed field path into the key the plane compares on.
 * THE ONE PARSE SEAM (G214) is called rather than restated, and a dotted
 * spelling is not offered: a key may legally contain a dot.
 */
function keyOf(typed: string): { ok: true; key: string } | { ok: false; why: string } {
  let tokens: unknown
  try {
    tokens = JSON.parse(typed)
  } catch {
    return { ok: false, why: `"${typed}" is not a JSON token list, e.g. ["invoice","total"]` }
  }
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) return { ok: false, why: `"${typed}" is refused: ${parsed.refusal.kind}` }
  return { ok: true, key: fieldPathKey(parsed.path) }
}

/**
 * The rows a pair form opens with. A seed from a parked delivery (G3782) gives
 * one row per sample key, its SOURCE field filled — the type's field is the
 * operator's to name, because only the document type knows it.
 */
function rowsOf(seed: PairSeed | null): readonly MappingRow[] {
  if (seed === null || seed.sourceFields.length === 0) return [{ key: 0, sourceField: '', typeField: '' }]
  return seed.sourceFields.map((f, key) => ({ key, sourceField: f, typeField: '' }))
}

function PairForm(props: {
  readonly source: Source
  readonly origin: string
  readonly onPaired: () => void
  /** From a parked delivery's "Declare a pairing" (G3782); `null` opens empty. */
  readonly seed: PairSeed | null
  /** G3943 — every type the tenant has, by label; `null` when the read failed. */
  readonly types: readonly DocumentTypeChoice[] | null
  readonly onCancel: () => void
}): ReactNode {
  const [matchKind, setMatchKind] = useState<MatchKind>(props.seed?.matchKind ?? 'path_prefix')
  const [matchValue, setMatchValue] = useState(props.seed?.matchValue ?? '')
  const [documentTypeId, setDocumentTypeId] = useState('')
  const [rows, setRows] = useState<readonly MappingRow[]>(() => rowsOf(props.seed))
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (key: number, patch: Partial<Omit<MappingRow, 'key'>>): void => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (busy || documentTypeId === '') return
    const fieldMappings: { sourceField: string; fieldPathKey: string }[] = []
    for (const r of rows) {
      /* G3783 — a row whose TYPE field is left blank maps nothing and is not
         sent. A form seeded from a parked delivery opens one row per sample
         key, and a sample may carry a key the type does not declare; there is
         no other way to leave it unmapped. The plane still refuses a mapping
         that misses a field the type declares. */
      if (r.typeField.trim() === '') continue
      const k = keyOf(r.typeField)
      if (!k.ok) {
        setResult(k.why)
        return
      }
      fieldMappings.push({ sourceField: r.sourceField, fieldPathKey: k.key })
    }
    setBusy(true)
    declarePair({
      origin: props.origin,
      endpointId: props.source.endpointId,
      match: { kind: matchKind, value: matchValue },
      documentTypeId,
      fieldMappings,
    })
      .then((pair) => {
        setResult(`Paired — ${String(pair.mappedFields)} fields mapped, read as ${pair.expectedFidelity}.`)
        props.onPaired()
      })
      .catch((err: unknown) => { setResult(failureText(err)) })
      .finally(() => { setBusy(false) })
  }

  return (
    <form
      className="reasons"
      data-pair-form={props.source.endpointId}
      data-act-form="pair"
      data-pair-seeded={props.seed === null ? undefined : ''}
      onSubmit={submit}
    >
      <ActHead verb="Pair a document type" source={props.source} />
      <span className="lab">This source, and a pattern within it</span>
      <div className="choices">
        {(
          [
            ['path_prefix', 'A path prefix'],
            ['filename', 'An exact filename'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className="choice"
            type="button"
            data-match-kind={k}
            aria-pressed={matchKind === k}
            onClick={() => { setMatchKind(k) }}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="fields">
        <Field label="Pattern (compared literally)" name="matchValue" value={matchValue} onChange={setMatchValue} />
      </div>
      {/* C3-15, G3943 — the document type is CHOSEN by its label from
          `listDocumentTypes`, never typed as an id. Every type the tenant has
          is offered, including one no source is paired to yet. */}
      <span className="lab">The document type its files are</span>
      {props.types === null ? (
        <p className="q" data-types-state="failed">
          The document types could not be read. Reload the page to try again.
        </p>
      ) : props.types.length === 0 ? (
        <p className="q" data-types-state="none">
          No document type is declared in this tenant yet. A pair needs one to read its files as.
        </p>
      ) : (
        <div className="choices" role="group" aria-label="The document type its files are">
          {props.types.map((t) => (
            <button
              key={t.documentTypeId}
              className="choice"
              type="button"
              data-document-type-choice={t.documentTypeId}
              aria-pressed={documentTypeId === t.documentTypeId}
              onClick={() => { setDocumentTypeId(t.documentTypeId) }}
            >
              <DocumentTypeWords types={props.types} documentTypeId={t.documentTypeId} />
            </button>
          ))}
        </div>
      )}
      <p className="q">
        Type its fields as your administrator named them. A mapping that misses a field the
        type declares is refused, and so is one that names a field it does not.
      </p>
      <span className="lab">Field mapping — what the source calls it, against the type&rsquo;s field</span>
      {props.seed === null ? null : (
        <p className="q" data-pair-seed-note>
          Opened from a parked delivery: one row per field it carries. Leave a type field empty
          to leave that field unmapped.
        </p>
      )}
      {rows.map((r) => (
        <div className="fields" key={r.key} data-mapping-row>
          <Field
            label="Source field"
            name="sourceField"
            value={r.sourceField}
            onChange={(v) => { update(r.key, { sourceField: v }) }}
          />
          <Field
            label='Type field, as a token list — ["invoice","total"]'
            name="typeField"
            value={r.typeField}
            onChange={(v) => { update(r.key, { typeField: v }) }}
          />
        </div>
      ))}
      <div className="acts">
        <button
          className="abtn"
          type="button"
          data-add-mapping
          onClick={() => {
            setRows((rs) => [...rs, { key: (rs[rs.length - 1]?.key ?? 0) + 1, sourceField: '', typeField: '' }])
          }}
        >
          Map another field
        </button>
        <button className="abtn" type="submit" data-commit aria-disabled={busy || documentTypeId === ''}>
          Declare the pair
        </button>
        <button className="abtn" type="button" data-act-cancel onClick={props.onCancel}>Cancel</button>
      </div>
      {result === null ? null : <p className="result" role="status" data-pair-result>{result}</p>}
    </form>
  )
}

/**
 * Which row's form is open. Lifted to `Setup` (G3782) so a parked delivery
 * below the table can open its source's pair form, seeded from itself.
 * `seed` rides only on a `pair` opened from the pile; the row's own button
 * opens an unseeded form.
 */
type Open =
  | { readonly endpointId: string; readonly what: 'bind' }
  | { readonly endpointId: string; readonly what: 'pair'; readonly seed: PairSeed | null; readonly from: string | null }
  | null

function SourceRows(props: {
  readonly sources: readonly Source[]
  readonly origin: string
  readonly replace: (s: Source) => void
  readonly open: Open
  /** Opens (or closes) a row's form — which is DRAWN under the pane head (G4171). */
  readonly toggle: (endpointId: string, what: 'bind' | 'pair') => void
  /** G3943 — what each document type is called; `null` names every one neutrally. */
  readonly types: readonly DocumentTypeChoice[] | null
}): ReactNode {
  const { open, toggle } = props
  const [result, setResult] = useState<string | null>(null)
  const act = (fn: typeof stopSource, endpointId: string): void => {
    fn({ origin: props.origin, endpointId })
      .then((s) => {
        setResult(null)
        props.replace(s)
      })
      .catch((err: unknown) => { setResult(failureText(err)) })
  }

  return (
    <>
      <div className="tblwrap">
      <table className="tbl" data-sources>
        <caption className="sr-only">Sources</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">How it arrives</th>
            <th scope="col">Where</th>
            <th scope="col">Credential</th>
            <th scope="col">Document types</th>
            <th scope="col">State</th>
            <th scope="col"><span className="sr-only">Acts</span></th>
          </tr>
        </thead>
        <tbody>
          {props.sources.length === 0 ? (
            <tr>
              <td colSpan={7} data-sources-empty>
                No source is declared. Nothing will arrive until one is.
              </td>
            </tr>
          ) : null}
          {props.sources.map((s) => (
              <tr key={s.endpointId} data-source={s.endpointId} data-source-state={s.state}>
                <th scope="row">{s.label}</th>
                <td>{s.connection.kind === 'sftp' ? 'SFTP' : 'S3'}</td>
                <td className="mono">
                  {whereOf(s.connection)}
                  {s.connection.kind === 's3' ? (
                    <span className="q" data-external-id> · external id {s.connection.externalId}</span>
                  ) : null}
                </td>
                <td className="mono" data-credential-bound={s.credentialBoundAt === null ? 'no' : 'yes'}>
                  {s.credentialBoundAt === null ? 'none bound' : `bound ${stamp(s.credentialBoundAt)}`}
                </td>
                <td data-pairs={String(s.documentTypes.length)}>
                  {s.documentTypes.length === 0
                    ? 'none paired'
                    : s.documentTypes
                        .map((p) => `${p.match.value} → ${documentTypeName(props.types, p.documentTypeId)}`)
                        .join(' · ')}
                </td>
                <td className="state">
                  {s.state === 'stopped' && s.stoppedAt !== null
                    ? <span data-stopped-at={s.stoppedAt}>Stopped since {stamp(s.stoppedAt)}</span>
                    : STATE_WORDS[s.state]}
                </td>
                <td className="acts-cell">
                  {s.state === 'stopped' ? (
                    <button className="abtn" type="button" data-resume={s.endpointId} onClick={() => { act(resumeSource, s.endpointId) }}>
                      Resume
                    </button>
                  ) : (
                    <button className="abtn" type="button" data-stop={s.endpointId} onClick={() => { act(stopSource, s.endpointId) }}>
                      Stop
                    </button>
                  )}
                  <button
                    className="abtn"
                    type="button"
                    data-bind-open={s.endpointId}
                    aria-pressed={open?.endpointId === s.endpointId && open.what === 'bind'}
                    onClick={() => { toggle(s.endpointId, 'bind') }}
                  >
                    {s.credentialBoundAt === null ? 'Bind a credential' : 'Rotate the credential'}
                  </button>
                  <button
                    className="abtn"
                    type="button"
                    data-pair-open={s.endpointId}
                    aria-pressed={open?.endpointId === s.endpointId && open.what === 'pair'}
                    onClick={() => { toggle(s.endpointId, 'pair') }}
                  >
                    Pair a document type
                  </button>
                </td>
              </tr>
          ))}
        </tbody>
      </table>
      </div>
      {result === null ? null : <p className="failed" role="status" data-source-act-result>{result}</p>}
      <p className="q">
        Stopping a source is dated and reversible, and the deliveries stay where they are. Changing
        a source&rsquo;s path or key is a rebinding, which is not built yet &mdash; a source&rsquo;s
        configuration cannot be edited here.
      </p>
    </>
  )
}

export function Setup(props: { readonly origin: string }): ReactNode {
  const [load, setLoad] = useState<SourcesLoad>({ phase: 'reading' })
  const [declaring, setDeclaring] = useState(false)
  const [open, setOpen] = useState<Open>(null)
  /** Bumped after a pair is declared, so the pile re-reads what it drained. */
  const [pileEpoch, setPileEpoch] = useState(0)
  /**
   * The form just opened, to be brought into view and focused once drawn.
   * Since G4171 a row's form is drawn under the pane head, ABOVE the table, so
   * a row's own act needs this as much as the pile's "Declare a pairing" does:
   * otherwise focus stays on a button below the form it just opened. `first`
   * is what takes focus — the document-type choice for a seeded pairing (the
   * one thing the seed cannot fill), the form's first control otherwise.
   */
  const [reveal, setReveal] = useState<{ readonly form: string; readonly first: string } | null>(null)
  /**
   * G3943 — the tenant's document types, read once beside the sources. Their
   * NAMES are what Setup shows; `undefined` while reading, `null` if the read
   * failed (every type is then named by the neutral word, never by its id).
   */
  const [types, setTypes] = useState<readonly DocumentTypeChoice[] | null | undefined>(undefined)

  const refresh = useCallback((): void => {
    fetchSources({ origin: props.origin })
      .then((sources) => { setLoad({ phase: 'read', sources }) })
      .catch((err: unknown) => { setLoad(loadFrom(err)) })
  }, [props.origin])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    let live = true
    fetchDocumentTypes({ origin: props.origin })
      .then((t) => { if (live) setTypes(t) })
      .catch(() => { if (live) setTypes(null) })
    return () => { live = false }
  }, [props.origin])

  const onPaired = useCallback((): void => {
    refresh()
    setPileEpoch((e) => e + 1)
  }, [refresh])

  const declarePairing = useCallback((r: PairingRequest): void => {
    setOpen({ endpointId: r.endpointId, what: 'pair', seed: r.seed, from: r.arrivalId })
    setReveal({ form: `[data-pair-form="${CSS.escape(r.endpointId)}"]`, first: '[data-document-type-choice]' })
  }, [])

  const toggle = useCallback((endpointId: string, what: 'bind' | 'pair'): void => {
    const closing = open !== null && open.endpointId === endpointId && open.what === what
    setOpen(closing ? null : what === 'bind' ? { endpointId, what } : { endpointId, what, seed: null, from: null })
    if (!closing) setReveal({ form: `[data-${what}-form="${CSS.escape(endpointId)}"]`, first: 'input, button' })
  }, [open])

  /** Cancel closes the form and hands focus back to the row act that opened it. */
  const cancelAct = useCallback((): void => {
    if (open === null) return
    const back = `[data-${open.what}-open="${CSS.escape(open.endpointId)}"]`
    setOpen(null)
    document.querySelector<HTMLButtonElement>(back)?.focus()
  }, [open])

  useEffect(() => {
    if (reveal === null) return
    const form = document.querySelector<HTMLFormElement>(reveal.form)
    if (form !== null) {
      form.scrollIntoView({ block: 'nearest' })
      form.querySelector<HTMLElement>(reveal.first)?.focus({ preventScroll: true })
    }
    setReveal(null)
  }, [reveal])

  const known = load.phase === 'read' ? load.sources : null
  const offersPairing = useCallback(
    (endpointId: string): boolean => known !== null && known.some((s) => s.endpointId === endpointId),
    [known],
  )

  const replace = (s: Source): void => {
    setLoad((l) =>
      l.phase === 'read'
        ? { phase: 'read', sources: l.sources.map((x) => (x.endpointId === s.endpointId ? s : x)) }
        : l,
    )
  }

  let body: ReactNode
  if (load.phase === 'reading' || (load.phase === 'read' && types === undefined)) {
    body = <p className="q" role="status" data-setup-state="reading" data-reading="">Reading your sources.</p>
  } else if (load.phase === 'no-session') {
    body = <p data-setup-state="no-session">You are not signed in. Sign in again to see your sources.</p>
  } else if (load.phase === 'forbidden') {
    body = (
      <p className="q" data-setup-state="refused">
        Setup is for your tenant administrator. Ask them to connect where your documents come
        from.
      </p>
    )
  } else if (load.phase === 'refused') {
    body = (
      <p className="q" role="status" data-setup-state="failed">
        Your sources could not be read just now. Try again in a moment.
      </p>
    )
  } else {
    const acting = open === null ? undefined : load.sources.find((s) => s.endpointId === open.endpointId)
    body = (
      <section data-setup-state="read">
        <div className="paneh">
          <span className="lab">Sources</span>
          <button
            className="abtn"
            type="button"
            data-declare-open
            aria-pressed={declaring}
            onClick={() => { setDeclaring((d) => !d) }}
          >
            Declare a source
          </button>
        </div>
        {declaring ? (
          <DeclareForm
            origin={props.origin}
            onCancel={() => { setDeclaring(false) }}
            onDeclared={(s) => {
              setDeclaring(false)
              setLoad((l) => (l.phase === 'read' ? { phase: 'read', sources: [...l.sources, s] } : l))
            }}
          />
        ) : null}
        {/* U-26 · G4171 — A ROW'S FORM IS A `.reasons` BLOCK UNDER THE PANE
            HEAD, NOT A ROW OF THE TABLE. The pack draws every Setup form there
            and draws no table-row form at any width: `C1 Close.dc.html#work`,
            the `showSetup` pane — `.paneh` ("Sources" · "Declare a source"),
            then `<div class="reasons">`, then the `.scroller` table. G4074
            kept these forms in a `colSpan` row and pinned them to the
            scroller's visible width; that repair is retired with the row. The
            act that opens one stays in its row, and the form names the source
            it acts on (`ActHead`). */}
        {open === null || acting === undefined ? null : open.what === 'bind' ? (
          <BindForm key={acting.endpointId} source={acting} origin={props.origin} onBound={refresh} onCancel={cancelAct} />
        ) : (
          <PairForm
            key={`${acting.endpointId}:${open.from ?? 'unseeded'}`}
            source={acting}
            origin={props.origin}
            onPaired={onPaired}
            seed={open.seed}
            types={types ?? null}
            onCancel={cancelAct}
          />
        )}
        <SourceRows
          sources={load.sources}
          origin={props.origin}
          replace={replace}
          open={open}
          toggle={toggle}
          types={types ?? null}
        />
      </section>
    )
  }

  /* RV-17 (G3483) — `.page`, the drill-down frame (`secondary.css`), so Setup
     shares the run account's and the finding's left edge and their kernel
     classes (`.lab`, `.q`, `.abtn`, `.tbl`, `.result`, `.failed`). `.setup`
     stays for the pane's own geometry in `shell.css`. No utility class. */
  return (
    <div className="page setup" data-setup>
      <div className="head">
        <h1>Sources and packs</h1>
        <p>
          Where the documents come from, and what the agent is looking for in them. Both take
          effect on the next run rather than this one: a source bound or a rule changed halfway
          through a close would leave the period measured two ways.
        </p>
        <p className="q">
          A source&rsquo;s credential is held under your organisation&rsquo;s own key, and
          nothing that serves a page can read it back.
        </p>
      </div>
      {body}
      {/* C9 · ROW 18's OTHER HALF — "Both places" (G3782). The register's
          pile, the SAME component and the SAME read (`listParkedArrivals`),
          drawn where the person who drains it works. It is its own section,
          apart from the sources table and from any exception count; it hides
          itself on a 401/403 and when nothing is parked or drained. */}
      {/* G3943 — drawn once the names are read, and handed them, so the pile
          neither reads them a second time nor flashes a neutral word. */}
      {types === undefined ? null : (
        <ParkedPile
          origin={props.origin}
          place="setup"
          epoch={pileEpoch}
          onDeclarePairing={declarePairing}
          offersPairing={offersPairing}
          documentTypes={types}
        />
      )}
      {/* RC-26 (G3482) — TWO controls, as the pack draws them
          (`C1 Close.dc.html`, `.paneh`): the heading, and the act beside it.
          They were one `<Soon>` reading "Packs installed · Install a
          blueprint". `installPack` is declared and not mounted (G200). */}
      <section data-packs>
        <div className="paneh">
          <span className="lab">Packs installed</span>
          <Soon className="abtn">Install a blueprint</Soon>
        </div>
      </section>
    </div>
  )
}
