/**
 * ReconcileAI — RFC 8785 (JCS) canonicalisation. G20, applied 9 Aug 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHY IT HAD TO BE FIRST
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A hash is over BYTES. "Hash the canonical body" is undefined until something
 * states WHICH bytes represent a record — and until this file, nothing did.
 * `RecordChain` (`model/governance.ts`) says *"Hash of the previous record's
 * canonical body"* and `UsageAttestation.bodyHash` says *"canonical body"*,
 * over a definition that did not exist.
 *
 * JSON makes that gap real rather than pedantic. These are one logical object
 * and four byte strings:
 *
 *     {"amount":1000,"currency":"SGD"}
 *     {"currency":"SGD","amount":1000}      key order
 *     {"amount":1000.0,"currency":"SGD"}    number form
 *     {"amount":1000, "currency":"SGD"}     whitespace
 *
 * `JSON.stringify` emits keys in INSERTION order, which follows however the
 * object was built — so two code paths constructing "the same" audit row emit
 * different bytes and different hashes. The accidental scheme is not even
 * self-consistent with itself.
 *
 * 🛑 AND IT IS IRREVERSIBLE, PRECISELY. `RecordChain` is a linked list:
 * record N's hash covers record N-1's. Change the scheme at record 1,000 and
 * there are three options and no good one — keep both implementations forever
 * with a switchover marker; re-hash history, WHICH MEANS REWRITING THE RECORDS
 * THE CHAIN EXISTS TO PROVE WERE NOT REWRITTEN; or lose end-to-end
 * verifiability. The property is gone either way. That is what "irreversible
 * after the first hash" means: not hard to change — the change destroys the
 * thing.
 *
 * 🛑 THE SHARPEST CONSEQUENCE IS THE BYOA ANCHOR. `model/governance.ts` states
 * that the chain makes an edited row detectable and does NOT defend against a
 * root holder who rewrites the whole chain — *"and under BYOA that is exactly
 * who holds the database"* — which is why `ChainAnchor` ships the head hash
 * upward as a scalar carrying no tenant data, so invariant 3 holds. **But the
 * anchor is a COMPARISON OF TWO HASHES COMPUTED BY TWO PARTIES.** Under an
 * ambiguous scheme the customer's head and ours can differ for entirely
 * innocent reasons — a different key order from a different code path — and
 * innocent divergence becomes indistinguishable from tampering. The control's
 * only output stops answering its question.
 *
 * This is also why G20 refused a hand-rolled serialiser: *"under BYOA two
 * implementations agreeing is evidence; the same code agreeing is not."* Two
 * parties running one buggy library agree perfectly and prove nothing. Two
 * independent implementations of a PUBLISHED SPEC agreeing is evidence.
 *
 * The named failure shape is CVE-2017-12635 (CouchDB): one document, two
 * parsers, two authorisation answers.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 IT DOES NOT HASH. It returns the canonical STRING and stops.
 * Hashing needs `node:crypto`, and `model/tsconfig.json` is standalone — no
 * `package.json`, no `node_modules`, no `extends` — verified to compile alone,
 * and `CLAUDE.md` records that property as one to keep. Importing a Node
 * built-in here would end it for a one-line call the caller can make. The
 * hasher lives with the writer, outside `model/`.
 *
 * 🛑 IT REFUSES `bigint` RATHER THAN SERIALISING IT. After G65 `Money.amountMinor`
 * is `bigint`, and G111 rules that EXACTLY ONE money codec owns the
 * representation — decimal string on the wire. A canonicaliser that invented a
 * bigint encoding would be a SECOND answer to how money is represented, on the
 * bytes an audit chain signs. That is §5.3 with the worst possible blast radius.
 * Convert first, canonicalise second.
 *
 * 🛑 IT REFUSES RATHER THAN DROPS. `JSON.stringify` silently omits a key whose
 * value is `undefined`. A dropped key changes the hash while looking like it
 * changed nothing, so a record that quietly lost a field verifies as a
 * different record with no error anywhere. Every refusal names a JSON-Pointer
 * path so the caller can find the offending field.
 *
 * Failures are RETURNED, never thrown — the house posture, matching
 * `ModelResolution`, `Decision` and `SetReconciliationOutcome`.
 */

/** Why a value could not be canonicalised, and where it was found. */
export type CanonicalisationRefusal =
  | { kind: 'non_finite_number'; path: string }
  | { kind: 'unsupported_type'; path: string; typeName: string }
  | { kind: 'cycle'; path: string }

export type CanonicalisationResult =
  | { ok: true; json: string }
  | { ok: false; refusal: CanonicalisationRefusal }

/**
 * The JSON data model, and nothing else. A `Date`, a `Map`, a class instance or
 * anything carrying `toJSON` is REFUSED rather than silently transformed —
 * `JSON.stringify` would call `toJSON` and hash whatever it returned, which
 * puts an arbitrary method between the record and its own hash.
 */
export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [k: string]: CanonicalValue }

function isPlainObject(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/**
 * RFC 8785 §3.2.3 sorts property names by their UTF-16 CODE UNITS.
 *
 * ⚠️ `Array.prototype.sort()` with no comparator does exactly that — it compares
 * UTF-16 code units. `localeCompare` does NOT, and neither does any
 * `Intl.Collator`: under most locales `'a'` sorts before `'B'`, where JCS
 * requires `'B'` first. **That single substitution is the likeliest way a second
 * implementation silently disagrees with this one**, which is the failure the
 * whole module exists to prevent, so it is named here rather than left to be
 * rediscovered.
 */
function jcsSortedKeys(o: { readonly [k: string]: unknown }): string[] {
  return Object.keys(o).sort()
}

/**
 * Canonicalise a value to its RFC 8785 form.
 *
 * Scalars delegate to `JSON.stringify`, which is already ECMAScript-conformant
 * for exactly the things JCS defers to it on: `Number::toString` (so `1.0` is
 * `1`, `1e30` is `1e+30`, `-0` is `0`) and minimal JSON string escaping with
 * non-ASCII left as UTF-8. What this function adds is the STRUCTURE — key
 * ordering at every depth, no insignificant whitespace, and a closed value
 * domain with refusals instead of surprises.
 */
export function canonicalise(value: unknown): CanonicalisationResult {
  const seen = new Set<object>()

  function walk(v: unknown, path: string): CanonicalisationResult {
    if (v === null) return { ok: true, json: 'null' }

    const t = typeof v
    if (t === 'boolean') return { ok: true, json: v === true ? 'true' : 'false' }
    if (t === 'string') return { ok: true, json: JSON.stringify(v) }
    if (t === 'number') {
      const n = v as number
      if (!Number.isFinite(n)) return { ok: false, refusal: { kind: 'non_finite_number', path } }
      /* JSON.stringify(-0) is "0"; JCS has one zero and this relies on that. */
      return { ok: true, json: JSON.stringify(n) }
    }
    if (t !== 'object') {
      return { ok: false, refusal: { kind: 'unsupported_type', path, typeName: t } }
    }

    const o = v as object
    if (seen.has(o)) return { ok: false, refusal: { kind: 'cycle', path } }
    seen.add(o)

    try {
      if (Array.isArray(o)) {
        const parts: string[] = []
        for (let i = 0; i < o.length; i += 1) {
          /* noUncheckedIndexedAccess: the index is in range by construction, and
           * a hole in a sparse array reads `undefined` and is refused below as
           * an unsupported type — which is correct, since JSON has no holes. */
          const r = walk(o[i], `${path}/${i}`)
          if (!r.ok) return r
          parts.push(r.json)
        }
        return { ok: true, json: `[${parts.join(',')}]` }
      }

      if (!isPlainObject(o)) {
        return {
          ok: false,
          refusal: { kind: 'unsupported_type', path, typeName: o.constructor?.name ?? 'object' },
        }
      }

      const rec = o as { readonly [k: string]: unknown }
      const parts: string[] = []
      for (const k of jcsSortedKeys(rec)) {
        const r = walk(rec[k], `${path}/${k}`)
        if (!r.ok) return r
        parts.push(`${JSON.stringify(k)}:${r.json}`)
      }
      return { ok: true, json: `{${parts.join(',')}}` }
    } finally {
      /* Released on the way out so a value REPEATED across sibling branches — a
       * shared reference, which is legal JSON — is not mistaken for a cycle. */
      seen.delete(o)
    }
  }

  return walk(value, '')
}
