/**
 * THE RUN PAGE'S WORDS — fix/c1-round4-frontend, G3831–G3835, 4 Oct 2026
 * (DERIVED, NOT THE OWNER'S). Red-team round three, C3-01, C3-13, C3-27.
 *
 * Plain `.ts` and no JSX, so `tests/app/c1-round4.test.ts` reaches every
 * decision here under `node --test` — `completeness.ts`'s reason for existing.
 *
 * 🛑 C3-01 — `lineIndex` IS NULLABLE ON THE WIRE AND THE PAGE CRASHED ON IT.
 * A header-grain document's residue item names no line (`ItemRef.lineIndex`
 * is `null`), `RunAccount.tsx` called `countOf(null)`, React threw on
 * `toLocaleString` and unmounted the whole tree, chrome included — every run
 * that produced anything rendered a blank white page. `ResidueEntry`'s type
 * now says `number | null`, so the bare call is a `tsc` error, and the cell
 * says in words that the open item is the whole document.
 *
 * 🛑 C3-13 — DOCUMENTS ARE NAMED BY THEIR PLACE IN THE RUN, NEVER BY THEIR ID.
 * The run's own account lists its documents (`documentAccounts`), and nothing
 * the plane serves names one — `RunDocumentAccount` has no filename BY DESIGN
 * (invariant 6). So a document is "File 3" — its position in the account's
 * own list — on both tables, and the id stays the row's `data-` subject. A
 * residue item whose document the account does not list is "A file".
 */

import type { PlaneRefused } from './api/runs.ts'

/** What the residue table's Line cell says. */
export function lineCellOf(lineIndex: number | null): string {
  return lineIndex === null ? 'Whole file' : lineIndex.toLocaleString('en-GB')
}

/** The ordinal names of the run's documents, in the account's own order. */
export function documentNamesOf(ids: readonly string[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  for (const id of ids) {
    if (!names.has(id)) names.set(id, `File ${String(names.size + 1)}`)
  }
  return names
}

export function documentNameOf(names: ReadonlyMap<string, string>, id: string): string {
  return names.get(id) ?? 'A file'
}

/**
 * C3-13 — WHAT THE "LEFT OPEN" PANEL SAYS WHEN THE RESIDUE IS EMPTY. On a
 * REFUSED run it said *"The engine closed every line. Nothing is left open."*
 * — false: nothing was matched at all. Only a PRODUCED run with an empty
 * residue closed everything.
 */
export function emptyResidueSentenceOf(outcome: 'produced' | 'refused' | null): string {
  if (outcome === 'refused') return 'Nothing was matched in this run, so nothing is listed here.'
  return 'Every line was matched. Nothing is left open.'
}

/**
 * C3-27 / C3-06 — A READ REFUSED BY ROLE IS NOT A TRANSIENT FAILURE. The run
 * page answered a 403 with *"This could not be read. Try again in a moment."*,
 * and a refusal by role is deterministic: retrying never helps.
 *
 * ⚠️ G3882 — THIS READ *"Runs are not part of your role. The register on Close
 * is still yours."* AND IS CORRECTED RATHER THAN DELETED. Since G3801 every
 * customer role that reads the register reads its runs (`view_run` is carried
 * by `view_exception`, G3881), so the only callers who meet this 403 are a
 * partner under a grant — refused by the owner's G3802 ruling, *"partners still
 * see exceptions, not run residue"* — and a role that reads no register at
 * all. "The register is still yours" was false for the second; the sentence
 * below is true for both and names who DOES read a run.
 */
export const NOT_YOUR_ROLE =
  "Runs are read only by the customer's roles that read the register. Partners work the register's lines, not a run's residue."

export const NOT_READ = 'This could not be read. Try again in a moment.'

export function readRefusalSentenceOf(err: Pick<PlaneRefused, 'status'> | null): string {
  return err !== null && err.status === 403 ? NOT_YOUR_ROLE : NOT_READ
}
