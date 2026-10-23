/**
 * `listDocumentTypes` — WHAT EACH DOCUMENT TYPE IS CALLED. G3941–G3943,
 * 4 Oct 2026, C3-15 of `docs/build/ui-audit/red-c1-round3.md`.
 *
 * ┌─ WHAT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ─────────────────────────┐
 * │ Three customer surfaces named a document type by its ID and by nothing     │
 * │ else: the parked pile's picker (`dt_demo_card_receivable`), its "Raised    │
 * │ with the FDE as …" line, and Setup's pair rows (`/settlement/daily/ →      │
 * │ dt_demo_acquirer_line`). Setup's pairing form went further and asked a     │
 * │ person to TYPE an id. `tenant.document_type.label` existed from `0180` and │
 * │ no operation on any of the seven tiers published it — derive it at the     │
 * │ commit before this one: `grep -rn 'label' server/data-plane/sources.ts     │
 * │ server/data-plane/parked.ts` names no document-type label.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ─── THE CHOICE: ONE LIST, NOT A LABEL ON THREE READS (G3942) ───────────────
 *
 * The alternative was to add a `documentTypeLabel` beside every
 * `documentTypeId` on `listEndpoints`' pairs, `listParkedArrivals`' drains and
 * the escalation. **It cannot serve the pairing form**, which must offer
 * every type the tenant HAS — including one no source is paired to yet, which
 * is exactly the type a person is pairing. The parked picker had the same
 * defect in a quieter form: it offered only types already paired to that
 * source (`ParkedPile.tsx`), so a parked file of a new kind had no right
 * answer on the list. One pick list answers all three surfaces and puts the
 * label in one place on the wire, where three copies would be §5.3.
 *
 * ─── G300: TABLE AND MODEL AND CAPABILITY ───────────────────────────────────
 *
 *   TABLE       `tenant.document_type`, `0180`, `SELECT` to the app role, RLS
 *               on 0001's predicate. No migration lands with this file.
 *   MODEL       `DocumentType` — `id`, `label`, `expectedFidelity` are three of
 *               its seven declared fields (`model/domain.ts`), read through
 *               `listDocumentTypes()` in `document-type-store.ts`, whose answer
 *               type is narrowed from `StoredDocumentType` so a renamed model
 *               field is a compile error here.
 *   CAPABILITY  `view_endpoint`, of class `endpoint`. ⚠️ ARGUED, NOT DEFAULTED:
 *               every surface that needs a type's NAME is a place a type is
 *               CHOSEN for a source — the pairing (`declareEndpointDocumentType`
 *               is `configure_endpoint`) and the parked pile (whose three reads
 *               are `view_endpoint`). A type's label is not tenant data in
 *               invariant 4's sense — it is the pack's own name for a shape —
 *               so `view_document` would gate it behind a stronger reach than
 *               the surfaces that show it. And G209 already put `view_endpoint`
 *               in both partner operating scopes, so a partner triaging a
 *               parked file sees the same names the customer does.
 *
 * 🛑 INVARIANT 10: mounted through `authorisedHandler()`, so the act mints its
 * `tenant.authorization_grant` row BEFORE the read, in the same transaction.
 * `resourceId: null` — *"opening a list"*.
 *
 * ⚠️ THE LABEL IS PUBLISHED VERBATIM AND INTERPRETED BY NOTHING — not trimmed,
 * not defaulted. An empty one is the client's to render as a neutral word;
 * this plane does not author a name for a type nobody named (`0161`'s rule
 * about authored prose, one table over).
 */

import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import { listDocumentTypes } from './document-type-store.ts'

const listDocumentTypesBody: AuthorisedBody = async ({ reply, tx }) => {
  const read = await listDocumentTypes(tx)
  if (read.kind === 'unreadable') {
    console.error(
      `data-plane: the document types could not be published — \`${read.defect.table}.${read.defect.column}\` ` +
        'carries a value or a shape the domain model does not define. Nothing was published.',
    )
    return sendProblem(reply, {
      status: 500,
      code: CODES.upstreamUnavailable,
      title: 'The request could not be completed.',
      detail: 'A stored document type carries a value the domain model does not define.',
    })
  }
  return { documentTypes: read.documentTypes }
}

/** `resourceId: null` — *"opening a list"*, `listEndpoints`' case. */
export const listDocumentTypesOperation: AuthorisedOperation = {
  operationId: 'listDocumentTypes',
  resourceType: 'DocumentType',
  instanceOf: () => null,
  body: listDocumentTypesBody,
}
