/**
 * ReconcileAI — THE FIELD PATH SEAM. The one place a `FieldPath` is made, keyed
 * or resolved.
 *
 * G214, 22 Aug 2026: `FieldPath` becomes a structured token list — a branded
 * array of segments, parsed at ONE seam. Not a string with a grammar. The
 * grammar itself is stated once, on the declaration in `model/kernel.ts`; this
 * module is its only executable form.
 *
 * ONE SEAM PARSES; NOTHING ELSE TOUCHES THE REPRESENTATION. That is the same
 * shape G111 demands of the money codec and G67 of `parseFxRate()`, taken for
 * the same reason: correctness that lives at call sites is correctness that
 * drifts. `tests/model/field-path-addresses-a-payload.test.ts` makes it
 * mechanical rather than a review convention — it walks every module in
 * `model/` and fails on a second `parseFieldPath`, on any cast to `FieldPath`
 * outside this file, and on any attempt to split a string on a dot or a slash
 * anywhere. (That last control greps for the call, so this sentence describes it
 * rather than reproducing it — a comment that trips a control makes the control
 * useless.)
 *
 * ─── WHAT THIS MODULE DELIBERATELY DOES NOT KNOW ───
 *
 * 🛑 IT DOES NOT KNOW ABOUT CLASSIFICATION AT ALL, AND THE TEST ASSERTS THAT BY
 * GREPPING THIS FILE FOR THE CLASS TYPE'S NAME — which is why the name does not
 * appear here even in prose. Addressing and classification are two questions.
 * G106 refused defaulting an unmapped key to the most sensitive class, because
 * readable-by-default-with-a-high-bar is scope failing OPEN — and a resolver
 * that can name a class is a resolver that can invent one. `addressableKeys()`
 * therefore answers only *is this position declared*, and the caller joins that
 * to `FieldSpec.dataClass`.
 *
 * It takes no tenant, no clock and no id. It is pure and total: every input has
 * an answer and none of them is a throw. Invariant 1 is untouched because there
 * is nothing here to scope — a read of a stored payload happens in
 * `db/tenant-scope.ts`, where G100's deny-on-NULL means a forgotten transaction
 * yields an empty result rather than a cross-tenant read.
 *
 * ─── INVARIANT 6 — INGESTED CONTENT IS DATA, NEVER INSTRUCTION ───
 *
 * A payload KEY is counterparty-controlled text. NO REFUSAL IN THIS MODULE
 * CARRIES ONE. Every arm carries at most a segment ORDINAL — a number, naming
 * the position in the operator's own declared path that failed. A refusal is
 * the value most likely to reach a log line or a span attribute, and the
 * cheapest way to make that harmless is for the type not to admit the text.
 * The compile-time proof lives in `model/identity.ts`
 * (`_FieldPathRefusalsHoldNoText`), which is this model's leaf and imports
 * everything; putting it here would have made the seam import the engine.
 */

import type { FieldPath, FieldPathKey, FieldSegment, Json } from './kernel'

/* ==================================================================== *
 * §1  THE BOUND — a path is not allowed to be arbitrarily deep
 * ==================================================================== */

/**
 * A declared path deeper than this is refused at the seam.
 *
 * ⚠️ IT IS A BOUND, NOT A JUDGEMENT ABOUT REAL DOCUMENTS, and it is stated
 * rather than defaulted for the reason `SubsetSumBound` is: an unbounded walk
 * over attacker-influenced input is a denial-of-service surface, and a bound
 * nobody wrote down is a bound nobody can review. Sixteen is far above any
 * observed nesting in the corpus and far below anything that costs time.
 */
export const MAX_FIELD_PATH_DEPTH = 16

/* ==================================================================== *
 * §2  RESULT UNIONS — every failure here is a value
 * ==================================================================== */

/**
 * Why a token list was not a path. Carries ORDINALS ONLY — see the invariant 6
 * note in the header.
 */
export type FieldPathRefusal =
  /** Not an array at all. A dotted or pointer string lands here, deliberately. */
  | { readonly kind: 'not_a_token_list' }
  /** `[]` addresses the document root, and the root is not a field. */
  | { readonly kind: 'empty_token_list' }
  | { readonly kind: 'exceeds_max_depth' }
  /** Neither a string nor a number at this ordinal. */
  | { readonly kind: 'segment_not_a_token'; readonly at: number }
  /** A key segment of zero length. `{ "": 1 }` is legal JSON; declaring it is not. */
  | { readonly kind: 'key_segment_is_empty'; readonly at: number }
  /** An index that is negative, fractional, `NaN` or `Infinity`. */
  | { readonly kind: 'index_segment_not_a_non_negative_integer'; readonly at: number }

export type FieldPathParse =
  | { readonly ok: true; readonly path: FieldPath }
  | { readonly ok: false; readonly refusal: FieldPathRefusal }

/**
 * Why a valid path addressed nothing in THIS document. Distinct from
 * `FieldPathRefusal` because they are different faults with different fixes: one
 * is a bad declaration, the other is a document that does not carry the field.
 * Folding them into one union is the shape `docs/HANDOFF.md` §5.2 catalogues.
 */
export type FieldPathResolutionRefusal =
  /** The object has no OWN property at this segment. */
  | { readonly kind: 'key_absent'; readonly at: number }
  /** A key segment met a scalar, an array or `null`. */
  | { readonly kind: 'not_an_object'; readonly at: number }
  /** An index segment met something that is not an array. */
  | { readonly kind: 'not_an_array'; readonly at: number }
  | { readonly kind: 'index_out_of_range'; readonly at: number }

/**
 * 🛑 THE SUCCESS ARM CARRIES THE VALUE AND THE REFUSAL ARM IS A CLOSED UNION.
 * NEITHER IS `undefined`, AND THAT IS THE WHOLE POINT OF THE SHAPE.
 *
 * The obvious signature is `resolve(...): Json | undefined`, and it is
 * fail-open: `undefined` is what you get for *the key is absent* AND for *the
 * key is present and holds `undefined`* AND, through any falsy test a caller
 * writes, for `null`, `0`, `''` and `false`. G178 names that shape elsewhere in
 * this model precisely so it is not reintroduced. Here a present key ALWAYS
 * resolves, whatever it holds, and an absent key ALWAYS refuses, by name.
 */
export type FieldPathResolution =
  | { readonly ok: true; readonly value: Json }
  | { readonly ok: false; readonly refusal: FieldPathResolutionRefusal }

/* ==================================================================== *
 * §3  THE PARSE — the only door
 * ==================================================================== */

/**
 * THE ONE SEAM. External input in, a `FieldPath` or a refusal out.
 *
 * ─── THE WIRE FORM, PINNED HERE ───
 *
 * A path crosses a tier as a JSON ARRAY whose members are strings and numbers:
 *
 *     ["invoice", "lines", 0, "amount"]        → key key index key
 *     ["payer.ref", "code"]                    → two keys, one containing a dot
 *
 * A STRING member is a key segment; a NUMBER member is an array index. That is
 * the entire encoding and there is nothing in it to escape, which is the
 * property the token list was chosen for. A caller that hands this function a
 * dotted or pointer STRING gets `not_a_token_list` rather than a plausible
 * misreading — the failure is loud on purpose.
 *
 * ⚠️ IT TAKES `unknown`, NOT `readonly (string | number)[]`. The input is a
 * parsed JSON body or an operator form field; a signature that assumed the
 * shape would push the validation back out to the boundary this function exists
 * to remove.
 */
export function parseFieldPath(input: unknown): FieldPathParse {
  if (!Array.isArray(input)) return { ok: false, refusal: { kind: 'not_a_token_list' } }

  /* `Array.isArray` narrows `unknown` to `any[]`, which would put `any` into
   * every expression below. Re-typing it here is the cheapest way to keep the
   * rest of this function honest. */
  const tokens: readonly unknown[] = input

  if (tokens.length === 0) return { ok: false, refusal: { kind: 'empty_token_list' } }
  if (tokens.length > MAX_FIELD_PATH_DEPTH) {
    return { ok: false, refusal: { kind: 'exceeds_max_depth' } }
  }

  const segments: FieldSegment[] = []
  for (let at = 0; at < tokens.length; at += 1) {
    const token: unknown = tokens[at]

    if (typeof token === 'string') {
      if (token.length === 0) return { ok: false, refusal: { kind: 'key_segment_is_empty', at } }
      segments.push({ kind: 'key', key: token })
      continue
    }

    if (typeof token === 'number') {
      /* `Number.isInteger` is false for `NaN` and both infinities, so this one
       * predicate closes all three. `-0` passes and is `0`. */
      if (!Number.isInteger(token) || token < 0) {
        return { ok: false, refusal: { kind: 'index_segment_not_a_non_negative_integer', at } }
      }
      segments.push({ kind: 'index', index: token })
      continue
    }

    return { ok: false, refusal: { kind: 'segment_not_a_token', at } }
  }

  /* THE ONLY MINT IN THE REPOSITORY. The brand is erased at run time, so this
   * assertion costs nothing and buys the property that every other module can
   * only obtain a `FieldPath` from here. */
  return { ok: true, path: segments as unknown as FieldPath }
}

/* ==================================================================== *
 * §4  THE KEY — identity, one way only
 * ==================================================================== */

/**
 * A `FieldPath` collapsed to its identity token, so it can key a `Map`, a `Set`
 * or a `Record`.
 *
 * ─── WHY IT IS LENGTH-PREFIXED AND NOT JOINED ───
 *
 * A separator-joined encoding has the defect this whole slice exists to remove:
 * `['a.b']` and `['a', 'b']` collide under `join('.')`, and the collision is
 * silent. Prefixing each key with its own length makes the encoding injective
 * for any alphabet — reading it back is deterministic, so two distinct paths
 * cannot produce the same token. `itemKey()` in `model/reconciliation.ts` uses
 * the identical device, and its own comment records why it was needed there.
 *
 * The `i` / `k` tags separate the two segment kinds, so the index `0` and the
 * string key `"0"` are different tokens — the array-index rule from the
 * declaration, carried through to identity.
 *
 * ⚠️ THERE IS NO INVERSE AND THERE MUST NOT BE ONE. Adding a reader would make
 * this a grammar, and a grammar is a thing that can be got wrong at a boundary.
 * A caller that needs the segments has the `FieldPath` itself.
 */
export function fieldPathKey(path: FieldPath): FieldPathKey {
  let token = ''
  for (const segment of path) {
    token += segment.kind === 'index' ? `i${segment.index}/` : `k${segment.key.length}:${segment.key}/`
  }
  return token as FieldPathKey
}

/** Segment count. Exposed so no caller reaches for `path.length` and its brand. */
export function fieldPathDepth(path: FieldPath): number {
  return path.length
}

/* ==================================================================== *
 * §5  RESOLUTION — exactly one position, or a named refusal
 * ==================================================================== */

/**
 * Walk one path through one document. Total, pure, and never a throw.
 *
 * 🛑 `Object.prototype.hasOwnProperty.call` RATHER THAN `key in object` OR
 * `object[key] !== undefined`, AND THE KEYS ARE WHY. A counterparty names the
 * fields: `constructor`, `__proto__` and `toString` arrive by choice, not by
 * accident. `in` walks the prototype chain, so a document with no `constructor`
 * of its own would resolve to `Object`'s — a function, reachable from a payload
 * position, handed to whatever reads the result. And the `!== undefined` test
 * is the G178 fail-open shape: it cannot tell an absent key from a present one
 * holding `undefined`.
 */
export function resolveFieldPath(payload: Json, path: FieldPath): FieldPathResolution {
  let cursor: unknown = payload
  let at = 0

  for (const segment of path) {
    if (segment.kind === 'key') {
      if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
        return { ok: false, refusal: { kind: 'not_an_object', at } }
      }
      if (!Object.prototype.hasOwnProperty.call(cursor, segment.key)) {
        return { ok: false, refusal: { kind: 'key_absent', at } }
      }
      cursor = (cursor as Record<string, unknown>)[segment.key]
    } else {
      if (!Array.isArray(cursor)) {
        return { ok: false, refusal: { kind: 'not_an_array', at } }
      }
      const elements: readonly unknown[] = cursor
      if (segment.index >= elements.length) {
        return { ok: false, refusal: { kind: 'index_out_of_range', at } }
      }
      cursor = elements[segment.index]
    }
    at += 1
  }

  return { ok: true, value: cursor }
}

/* ==================================================================== *
 * §6  ADDRESSABILITY — G106's fail-closed half, as a set
 * ==================================================================== */

/**
 * The positions a caller has DECLARED, as identity tokens.
 *
 * 🛑 THE SET IS BUILT FROM THE DECLARATIONS AND NEVER FROM THE DOCUMENT, AND
 * THAT IS THE WHOLE OF G106's FAIL-CLOSED HALF. A payload key with no
 * `FieldSpec` is not in this set, was never a candidate for it, and there is no
 * branch anywhere below that could add one — it is stored, and unaddressable by
 * any agent, prompt, export or dashboard. NOT "present with a default class";
 * ABSENT. G106's rejected alternative was defaulting an unmapped key to the most
 * sensitive class, refused because readable-by-default-with-a-high-bar is scope
 * failing OPEN.
 *
 * ⚠️ IT ALSO CARRIES NO COUNTERPARTY TEXT OUT, for a second reason worth
 * stating: enumerating the DOCUMENT would return keys a counterparty wrote, and
 * this function returns tokens derived from paths an OPERATOR wrote.
 */
export function addressableKeys(declared: readonly FieldPath[]): ReadonlySet<FieldPathKey> {
  const keys = new Set<FieldPathKey>()
  for (const path of declared) keys.add(fieldPathKey(path))
  return keys
}

/** Whether a path names a declared position. Fail-closed: unknown means no. */
export function isAddressable(
  addressable: ReadonlySet<FieldPathKey>,
  path: FieldPath,
): boolean {
  return addressable.has(fieldPathKey(path))
}
