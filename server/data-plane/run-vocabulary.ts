/**
 * THE ONE PLACE `server/` MEETS `model/`, AND IT IS DELIBERATELY ONE PLACE.
 *
 * 🛑 THAT SENTENCE WENT FALSE ON 19 Sep 2026 AND IS CORRECTED HERE RATHER THAN
 *    DELETED, because it is the sentence a reader would have trusted before
 *    deciding where to put a third one. **There are THREE meeting points now.**
 *    Derive it, do not read it:
 *    `grep -rl "from '\.\./\.\./model/" server/ | sort`
 *
 *      · this file                        `RUN_TRIGGER_KINDS`, G191
 *      · `server/data-plane/authorise.ts` `decide()` and `CAPABILITIES`, G200
 *      · `server/data-plane/engine-vocabulary.ts`
 *                                         `POSTCONDITION_PROPERTY`, G284
 *
 *    **The property that was load-bearing survives all three and is the one to
 *    keep: a vocabulary is DERIVED from the model, never transcribed beside it.**
 *    "One place" was a proxy for it, and a rule keyed on a convenient landmark
 *    instead of the property it protects is the most common defect shape in this
 *    codebase (`docs/HANDOFF.md` §5.1) — which is what this correction is.
 *
 * Until this module existed, neither container entry point reached a single
 * `model/` module. That was correct while the planes served nothing that needed
 * the engine's vocabulary — and it stopped being correct at the first read whose
 * values ARE that vocabulary.
 *
 * ┌─ THE HOLE THIS FILLS, AND IT IS A REAL ONE ────────────────────────────────┐
 * │ `db/migrations/0002_run.sql` declines a CHECK constraint on `status` and    │
 * │ `trigger_kind`, IN WRITING, and gives the reason: "Both are closed enums in │
 * │ `capability.openapi.yaml` AND in `model/domain.ts` … A third copy here      │
 * │ would be a third place to drift — and the one nothing checks, because no    │
 * │ pair in the wire-mirror addresses SQL."                                     │
 * │                                                                            │
 * │ That argument is right and it leaves a gap the migration does not claim to  │
 * │ close: NOTHING stood between those two unconstrained `text` columns and the │
 * │ wire. `fast-json-stringify` serialises a response; it does not validate one │
 * │ — an out-of-enum `status` in the row is an out-of-enum `status` in the      │
 * │ body, and the consumer learns a word the contract says cannot occur.        │
 * │                                                                            │
 * │ So the check goes where it can be DERIVED instead of copied: at the read    │
 * │ boundary, against the model. This is not a fourth copy. `RUN_STATUS` is     │
 * │ keyed by `RunStatus` and `RUN_TRIGGER_KIND` by `RunTrigger['kind']`, so a   │
 * │ member added to either union in `model/domain.ts` is a COMPILE ERROR here   │
 * │ rather than a list somebody forgot.                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 A TOTAL `Record` ONLY BITES WHERE SOMETHING CONSTRUCTS ONE — `CLAUDE.md`,
 * and `docs/HANDOFF.md` §5.10 records five total records landing with no
 * construction site anywhere, so `tsc` could not have failed on a single field
 * chosen. Both records below ARE constructed, in this file, at module scope, and
 * `server/data-plane/runs.ts` reads them on every row it publishes. That is the
 * difference between a shape that compiles and a control that runs.
 *
 * 🛑 `RUN_TRIGGER_KINDS` IS IMPORTED AS A VALUE, NOT A TYPE, AND THAT IS THE
 * POINT OF THE FILE. A type-only import is erased before Node's loader sees it,
 * so a seam built out of `import type` alone would satisfy an import walker
 * while the image never opened `model/` at runtime — the `.ts`-extension trap
 * inverted, and the §5.10 shape one layer out. The three configurable kinds are
 * spelled by the model's own constant; `manual` and `rerun` are literals because
 * the model deliberately keeps them OUT of that constant ("both are always
 * available to an operator and neither is a configuration choice"), and the
 * annotation is what holds them.
 */

import { RUN_TRIGGER_KINDS } from '../../model/domain.ts'
import type { RunStatus, RunTrigger } from '../../model/domain.ts'

/**
 * Every member of `RunStatus` (`model/domain.ts`), including O-16's
 * `incomplete` — "SOUND OVER LESS THAN EVERYTHING", neither `completed` nor
 * `failed`.
 */
export const RUN_STATUS: Readonly<Record<RunStatus, true>> = {
  queued: true,
  running: true,
  completed: true,
  failed: true,
  incomplete: true,
  /* G4033 — the sixth member arrived exactly as the note below predicts:
   * `TS2741` here, before anything else in `server/` noticed. */
  refused: true,
}

/**
 * Every discriminant of `RunTrigger` (`model/domain.ts`) — the three
 * CONFIGURABLE kinds named by the model's own constant, plus the two it
 * deliberately excludes from configuration.
 *
 * ⚠️ VERIFIED BY MUTATION RATHER THAN BY READING, AND ONE OF THE THREE DID NOT
 * BITE — recorded because a control nobody probed is a control nobody has.
 * Against `npx tsc -p server/tsconfig.json --noEmit`:
 *   • a sixth member on `RunStatus`               → TS2741 here. BITES.
 *   • a sixth member on the `RunTrigger` union    → TS2741 here. BITES.
 *   • a fourth key on `RUN_TRIGGER_KINDS` alone   → EXIT 0. DOES NOT BITE.
 * The third is correct and not a gap: `RUN_TRIGGER_KINDS` is the CONFIGURABLE
 * set, and a kind that is not also a member of `RunTrigger` is not a kind a run
 * can carry. But it means this record is TOTAL, not EXACT — a computed key does
 * not raise an excess-property error — so it can gain a key the union does not
 * have. What it cannot do is LOSE one, which is the direction that would let an
 * unmodelled value onto the wire.
 */
export const RUN_TRIGGER_KIND: Readonly<Record<RunTrigger['kind'], true>> = {
  [RUN_TRIGGER_KINDS.scheduled]: true,
  [RUN_TRIGGER_KINDS.ingest]: true,
  [RUN_TRIGGER_KINDS.sourceSignal]: true,
  manual: true,
  rerun: true,
}

/**
 * ⚠️ `Object.hasOwn`, NEVER `in`. `'constructor' in RUN_STATUS` is `true`, so
 * the obvious spelling admits every name on `Object.prototype` — a membership
 * test that answers yes for `toString` is a membership test that lets a
 * `toString` in the `status` column onto the wire.
 */
export function isRunStatus(value: string): value is RunStatus {
  return Object.hasOwn(RUN_STATUS, value)
}

export function isRunTriggerKind(value: string): value is RunTrigger['kind'] {
  return Object.hasOwn(RUN_TRIGGER_KIND, value)
}
