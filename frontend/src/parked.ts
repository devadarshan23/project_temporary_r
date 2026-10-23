/**
 * THE PARKED PILE'S WORDS AND DECISIONS — pure, so `node --test` pins them
 * without a renderer. feat/ui-parked-pile, G3501–G3510 (C9 rows 18 and 19).
 *
 * Row 18 (`Functional Specification.dc.html`): *"The register names them as
 * awaiting setup with the person who unblocks it named, because during
 * onboarding a parked pile is expected rather than a fault — and counted apart
 * from exceptions so the denominator stays honest."*
 *
 * Row 19: *"An user who cannot act still follows it, and lands on one pane
 * about that pair only — the sample, why it is parked, and who unblocks it.
 * Not a read-only copy of Setup, and never a dead sentence."*
 *
 * ⚠️ "THE PERSON WHO UNBLOCKS IT NAMED" IS DRAWN AS A ROLE, NOT A NAME. The
 * plane publishes a CAPABILITY (`unblockedBy.capability`) because naming the
 * people who hold it is the administrative directory (G2840, 🟠). The words
 * below say what that capability lets a person do, and nothing more.
 */

import type { ParkedBecause, ParkedPile } from './api/parked.ts'

/** Why a delivery is still parked, in a sentence. TOTAL over the contract's enum. */
export const PARKED_BECAUSE_WORD: Readonly<Record<ParkedBecause, string>> = {
  no_declared_pair_matches: 'No declared pair matches it, so it waits rather than being guessed into a type.',
  more_than_one_pair_matches: 'More than one declared pair matches it, so none is chosen for it.',
  pair_type_is_not_extractable: 'The pair that matches it names a type this product does not read yet.',
  artefact_does_not_fit_the_mapping: 'It does not fit the field mapping of the pair that matches it.',
  drain_owed: 'A pair now claims it and it has not been extracted yet.',
}

/** The same reason, short enough for the register's line. TOTAL. */
export const PARKED_BECAUSE_SHORT: Readonly<Record<ParkedBecause, string>> = {
  no_declared_pair_matches: 'no pair matches',
  more_than_one_pair_matches: 'two pairs match',
  pair_type_is_not_extractable: 'type not read yet',
  artefact_does_not_fit_the_mapping: 'does not fit the mapping',
  drain_owed: 'extraction owed',
}

/**
 * Who unblocks it, keyed on the CAPABILITY the plane names. The contract's enum
 * is `[configure_endpoint]`; a capability this map does not hold falls back to
 * a sentence that names no role rather than inventing one.
 */
export function unblockerOf(capability: string): string {
  return capability === 'configure_endpoint'
    ? 'Someone who sets up sources — they declare the pair this delivery belongs to.'
    : 'Someone who holds the capability this needs.'
}

/** What a filename of `null` is drawn as. Never an empty cell. */
export const NO_FILENAME = 'No filename was recorded'

/** `1 delivery` / `3 deliveries`. */
export function deliveriesOf(n: number): string {
  return `${n} ${n === 1 ? 'delivery' : 'deliveries'}`
}

/**
 * The register's summary sentence for the pile — row 18's count, kept apart
 * from the exception register's own, and row 13's raised count beside it.
 */
export function pileSummary(pile: Pick<ParkedPile, 'awaitingSetup'>): string {
  const { parked, raisedWithFde } = pile.awaitingSetup
  const raised = raisedWithFde === 0 ? '' : ` · ${raisedWithFde} raised with the 1CloudHub FDE`
  return `${deliveriesOf(parked)} parked, awaiting setup${raised}`
}

/**
 * Whether the pile draws at all. An empty pile with no drain to explain is
 * not a line: "nothing is awaiting setup" beside the register is noise, and a
 * zero is drawn nowhere else in the register either. A drain with nothing left
 * parked IS drawn — row 16: *"the register states why rather than leaving an
 * unexplained jump."*
 */
export function pileIsDrawn(pile: ParkedPile): boolean {
  return pile.items.length > 0 || pile.drains.length > 0
}

/**
 * WHAT "DECLARE A PAIRING" STARTS FROM — G3782 (C9 row 18's Setup half, and
 * row 6: *"The parked pile drains … automatically, on declaration"*).
 *
 * A parked delivery opened on Setup offers the pair form for ITS source,
 * pre-filled so the drain is one step away. The seed is a SUGGESTION the
 * operator edits; the plane decides (`declareEndpointDocumentType` refuses an
 * unknown type and a mapping that misses a declared field).
 *
 * The pattern follows `model/ingestion.ts#nameFallsUnder()`'s two rules and
 * never a third: a name with a folder seeds a `path_prefix` on that folder
 * (`checkSourcePair()` refuses a `/` in a `filename` pattern, so the folder
 * cannot be an exact filename), and a bare name seeds an exact `filename`.
 * No name recorded seeds an empty `path_prefix` — never a guess.
 *
 * ⚠️ INVARIANT 6 — the name and the keys are counterparty text. They reach the
 * form as input VALUES, which React sets as a property and never parses; they
 * are not markup, not an `href`, not a handler.
 */
export interface PairSeed {
  readonly matchKind: 'path_prefix' | 'filename'
  readonly matchValue: string
  /** The sample's top-level keys — each becomes a mapping row's SOURCE field. */
  readonly sourceFields: readonly string[]
}

export function pairSeedOf(filename: string | null, sampleFields: readonly string[]): PairSeed {
  const sourceFields = [...sampleFields]
  if (filename === null) return { matchKind: 'path_prefix', matchValue: '', sourceFields }
  const slash = filename.lastIndexOf('/')
  return slash === -1
    ? { matchKind: 'filename', matchValue: filename, sourceFields }
    : { matchKind: 'path_prefix', matchValue: filename.slice(0, slash + 1), sourceFields }
}
