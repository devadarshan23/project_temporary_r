/**
 * K6's REPAIR — NO SUCCESS BODY POINTS AT `errors.yaml`, AND THE COPIES THAT
 * REPLACED THE POINTERS ARE MIRRORS RATHER THAN FORKS.
 *
 * ┌─ THE RULING, AND IT IS THE OWNER'S ────────────────────────────────────────┐
 * │ 21 Sep 2026: *"Stop `$ref`-ing `errors.yaml` from success bodies. A        │
 * │ success body carries its own closed enum rather than pointing at the error │
 * │ taxonomy."* **`server/contract/bundle.ts` is NOT changed and its refusal   │
 * │ of external pointers stands** — §4 re-witnesses that refusal on every run, │
 * │ because a repair that quietly relaxed the bundler would have closed K6's   │
 * │ finding by deleting the property that produced it.                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHAT K6 MEASURED, AND WHY IT NEEDED A RULING RATHER THAN A LINE.
 * `tests/http/required-fields-served.test.ts` found SEVEN mounted operations —
 * `getThread`, `getMessage`, `listAvailableDispositions`, `listProposals`,
 * `proposeResolution`, `getProposal`, `decideApproval` — whose success bodies
 * transitively reached `./errors.yaml#/components/schemas/ErrorCode`,
 * legitimately, through `blockedBy`, `unavailableFor` and `rejectedFor`, which
 * reuse the closed error enum as a REASON CODE INSIDE A SUCCESS BODY.
 * `bundleSchema()` throws on the external pointer, `responseSchemas()` drops
 * the whole schema, `mountTier()` registers the route without one, and Fastify
 * silently falls back to `JSON.stringify`. For those seven the `required`
 * enforcement every other mounted operation gets **did not exist**.
 *
 * ⚠️ K6's OWN FRAMING IS KEPT BECAUSE IT IS THE HONEST ONE: it found no
 * incomplete body among the fifteen it drove, and *"that is not 'the seven are
 * safe'; the handlers are correct today and nothing would notice if they
 * stopped being."*
 *
 * ┌─ THE COST THIS FILE EXISTS TO PAY ─────────────────────────────────────────┐
 * │ A local copy of an 88-member vocabulary is a SECOND HOME for it, which is  │
 * │ `db/migrations/0002`'s *"third place to drift"*. `db/migrations/0008` has  │
 * │ the worked precedent for doing it safely — it seeds the three governance   │
 * │ lists as reference data and records that *"that copy is a MIRROR rather    │
 * │ than the third-place-to-drift `0002` forbids, and the thing that makes it  │
 * │ one is a test asserting set equality with `model/governance.ts` in BOTH    │
 * │ DIRECTIONS."* **§1 is that test.** A member added to `errors.yaml` and not │
 * │ to a copy is RED; a member in a copy that `errors.yaml` does not have is   │
 * │ RED; and so is the same set in a different ORDER, for                      │
 * │ `tools/check-wire-mirror.mjs`'s stated reason — two enums are read by      │
 * │ people side by side, and a reordering is the shape that hides the next     │
 * │ insertion. §1a and §1b witness both reds on every run.                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHY THIS IS NOT A PAIR IN `tools/check-wire-mirror.mjs`, having read it
 * first. Every one of its twenty-six pairs is MODEL -> WIRE, and its stated
 * axis is *"the model is the authority, the wire mirrors it"*. `ErrorCode` has
 * no declaration in `model/` at all — `server/http/problem.ts` reads its closed
 * set out of `errors.yaml` at import time — so this mirror is DOCUMENT ->
 * DOCUMENT and registering it would invert the tool's own axis. It would also
 * hand an 88-member enum to a line scanner that *"does not resolve `$ref`"* by
 * its own header, when `server/contract/document.ts` already holds the real
 * parser. **G109 IS NOT CLAIMED AS APPLIED BY THIS FILE.** Its `$ref`-resolving
 * half remains, in the checker's own words, *"unbuilt and unclaimed"*; `tools/`
 * still hand-rolls. This file uses `yaml@2.9.0` through `document.ts`, which is
 * the same exception `server/contract/document.ts` already takes.
 *
 * ⚠️ AND THE PRECEDENT FOR THE SHAPE IS ONE FILE OVER.
 * `tests/contracts/field-path-wire.test.ts` §3 already guards a STRUCTURAL COPY
 * this same bundler refusal forced on `FieldPath`, and `docs/contracts/README.md`
 * records it as *"a cost rather than a choice"* with the same closing sentence:
 * *"When the bundler learns to resolve a cross-file pointer, the copy collapses
 * to a `$ref`."* That sentence governs this copy too.
 *
 * 🛑 THE COPY IS NOT NARROWED, AND THE NON-NARROWING IS A MEASUREMENT RATHER
 * THAN A SHRUG. Only FIVE of the 88 can reach a success body today:
 * `BLOCKER_CODE` in `server/data-plane/resolution-vocabulary.ts` is a TOTAL
 * `Record<ApprovalBlocker, string>` over four (`approval_quorum_unmet`,
 * `proposal_not_executable`, `proposal_superseded`, `exception_already_resolved`)
 * and `dispositionSet()` writes two literals (`exception_already_resolved`,
 * `adjustment_currency_mismatch`). Three measured reasons refuse the narrowing,
 * and §5 pins the middle one because it is the one nobody had written down:
 *   1. `decidableBy.blockedBy` has NO producer at all — `correspondence-store.ts`
 *      omits the whole object and says why — so any subset there is a guess
 *      about a security gate that has not been built.
 *   2. At `fast-json-stringify@7.0.1` a bare `enum` is NOT enforced and an
 *      `enum` nested in a `oneOf` IS. `unavailableFor` is a `oneOf`, so an
 *      under-guess there is a **500 in production**, which is the failure this
 *      slice exists to remove rather than relocate.
 *   3. A narrow set has no mechanically checkable completeness direction —
 *      `unavailableFor`'s producer is an inline ternary with no totality — and
 *      the completeness direction is the entire control.
 * **This slice changes the POINTER, not the SURFACE.** Narrowing is a second
 * ruling and needs producers most of these fields do not have.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIERS,
  loadTier,
  type JsonValue,
  type OpenApiDocument,
  type TierName,
} from '../../server/contract/document.ts'
import { bundleSchema, ExternalRefError } from '../../server/contract/bundle.ts'
import { declaredSuccesses } from '../http/contract-shape.ts'

/* ------------------------------------------------------------------ *
 * THE AUTHORITY, AND THE THREE MIRRORS.
 * ------------------------------------------------------------------ */

/**
 * The documents that carry a local `ErrorCode`.
 *
 * 🛑 THIS IS NOT AN ALLOW-LIST. §1c derives the set from the tree and requires
 * it to equal this one, so a FOURTH document growing a copy without a row here
 * is a red — a copy nothing mirrors is exactly the fork this file refuses.
 */
const MIRRORS: readonly TierName[] = ['capability', 'foundation', 'controlPlane']

/**
 * THE AUTHORITY, AND IT IS A REGISTERED TIER RATHER THAN A FILE THIS READS.
 *
 * ⚠️ `errors.yaml` IS A MEMBER OF `TIERS`, which is why §1c and §2 subtract it
 * by name: it declares `ErrorCode` because it OWNS it, and a derivation that
 * did not subtract the authority would report the authority as a copy of
 * itself. Measured on the first run, not reasoned — `1c` failed with
 * `measured: capability, controlPlane, errors, foundation`.
 */
const AUTHORITY: TierName = 'errors'

function errorsYaml(): OpenApiDocument {
  return loadTier(AUTHORITY)
}

/** The `enum` of `#/components/schemas/<name>`, or `null` when there is none. */
function enumOf(doc: OpenApiDocument, name: string): readonly string[] | null {
  const components = doc['components']
  if (components === null || typeof components !== 'object' || Array.isArray(components)) return null
  const schemas = (components as Record<string, JsonValue>)['schemas']
  if (schemas === null || typeof schemas !== 'object' || Array.isArray(schemas)) return null
  const node = (schemas as Record<string, JsonValue>)[name]
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return null
  const members = (node as Record<string, JsonValue>)['enum']
  if (!Array.isArray(members)) return null
  return members.map((m) => {
    assert.equal(typeof m, 'string', `\`${name}\` carries a non-string enum member: ${String(m)}`)
    return m as string
  })
}

/* ------------------------------------------------------------------ *
 * THE COMPARISON, AS A PURE FUNCTION SO THE REDS CAN BE WITNESSED.
 *
 * ⚠️ IT IS A FUNCTION AND NOT AN INLINE `deepEqual` FOR ONE REASON: a mirror
 * asserted only against the tree is green on the day it is written and proves
 * nothing about the day a member moves. §1a and §1b drive THIS function against
 * deliberately drifted inputs, which is `tools/check-wire-mirror.mjs`'s own
 * acceptance condition — *"EVERY new source kind is verified RED against a
 * deliberately drifted fixture before it is pointed at the tree."*
 * ------------------------------------------------------------------ */

export interface MirrorDrift {
  /** In the authority, absent from the copy. */
  readonly missingFromCopy: readonly string[]
  /** In the copy, absent from the authority. */
  readonly notInAuthority: readonly string[]
  /** Same set, different order. */
  readonly reordered: boolean
}

export function mirrorDrift(
  authority: readonly string[],
  copy: readonly string[],
): MirrorDrift {
  const inCopy = new Set(copy)
  const inAuthority = new Set(authority)
  const missingFromCopy = authority.filter((m) => !inCopy.has(m))
  const notInAuthority = copy.filter((m) => !inAuthority.has(m))
  const reordered =
    missingFromCopy.length === 0 &&
    notInAuthority.length === 0 &&
    authority.some((m, i) => copy[i] !== m)
  return { missingFromCopy, notInAuthority, reordered }
}

function clean(d: MirrorDrift): boolean {
  return d.missingFromCopy.length === 0 && d.notInAuthority.length === 0 && !d.reordered
}

/* ------------------------------------------------------------------ *
 * WALKING A SUCCESS BODY FOR EXTERNAL POINTERS.
 *
 * ⚠️ IT PARSES; IT DOES NOT GREP. `grep -c 'errors.yaml#/components/schemas/
 * ErrorCode' docs/contracts/*.openapi.yaml` returns ONE PER DOCUMENT on this
 * tree and every one of them is the new schema's own COMMENT saying what it is
 * a copy of — §5.1 wearing a `grep`, in the commit that removed the last real
 * pointer. The instrument therefore follows `$ref`s through the parsed
 * document, exactly as `bundleSchema()` does.
 * ------------------------------------------------------------------ */

interface ExternalHit {
  readonly operationId: string
  readonly at: string
  readonly ref: string
}

function externalRefsInSuccessBodies(doc: OpenApiDocument): readonly ExternalHit[] {
  const components = doc['components']
  const schemas =
    components !== null && typeof components === 'object' && !Array.isArray(components)
      ? ((components as Record<string, JsonValue>)['schemas'] as Record<string, JsonValue> | undefined)
      : undefined
  const out: ExternalHit[] = []

  const walk = (
    node: JsonValue,
    at: string,
    seen: ReadonlySet<string>,
    push: (hit: Omit<ExternalHit, 'operationId'>) => void,
  ): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const n of node) walk(n, at, seen, push)
      return
    }
    const obj = node as Record<string, JsonValue>
    const ref = obj['$ref']
    if (typeof ref === 'string') {
      const local = /^#\/components\/schemas\/(.+)$/.exec(ref)
      if (local === null) {
        push({ at, ref })
        return
      }
      const name = local[1] ?? ''
      if (seen.has(name)) return
      const target = schemas?.[name]
      if (target !== undefined) walk(target, at, new Set([...seen, name]), push)
      return
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'properties' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [p, s] of Object.entries(v as Record<string, JsonValue>)) {
          walk(s, `${at}.${p}`, seen, push)
        }
      } else if (k === 'items') {
        walk(v, `${at}[]`, seen, push)
      } else if (v !== null && typeof v === 'object') {
        walk(v, at, seen, push)
      }
    }
  }

  for (const declared of declaredSuccesses(doc)) {
    if (declared.schema === null) continue
    walk(declared.schema as JsonValue, `<${declared.operationId}:${declared.status}>`, new Set(), (hit) =>
      out.push({ operationId: declared.operationId, ...hit }),
    )
  }
  return out
}

/**
 * THE ONE SUCCESS BODY THAT STILL REACHES ANOTHER DOCUMENT, HELD OUT BY NAME
 * AND WITH ITS ARGUMENT.
 *
 * 🛑 IT IS NOT `errors.yaml` AND IS THEREFORE NOT THIS RULING'S. The owner
 * ruled about the error taxonomy; `Meter` is a foundation-tier SCHEMA reused by
 * a control-plane success body, and copying it would be this slice taking a
 * ruling nobody gave it. `fetchEntitlementLeases` is DECLARED AND UNMOUNTED,
 * and §3 is what makes mounting it a red rather than a silent regression.
 */
const EXTERNAL_BY_ARGUMENT: ReadonlyMap<string, string> = new Map([
  [
    'fetchEntitlementLeases',
    '`leases[].ceilings` and `leases[].tierCeilings` reach ' +
      '`./foundation.openapi.yaml#/components/schemas/Meter`, which is NOT the error ' +
      'taxonomy and is outside the 21 Sep 2026 ruling. Declared and unmounted; §3 makes ' +
      'mounting it a red.',
  ],
])

/* ================================================================== *
 * THE SUITE.
 * ================================================================== */

describe('no success body points at errors.yaml, and the copies are mirrors', () => {
  /* ================================================================ *
   * §1 · THE MIRROR — SET EQUALITY IN BOTH DIRECTIONS, AND ORDER.
   * ================================================================ */

  it('1 · every local `ErrorCode` equals `errors.yaml`, member for member and in order', () => {
    const authority = enumOf(errorsYaml(), 'ErrorCode')
    assert.ok(
      authority !== null && authority.length > 0,
      '`errors.yaml#/components/schemas/ErrorCode` has no `enum`. It is the AUTHORITY for ' +
        'every copy this file guards; without it the mirror below is vacuous.',
    )

    for (const tier of MIRRORS) {
      const copy = enumOf(loadTier(tier), 'ErrorCode')
      assert.ok(
        copy !== null,
        `\`${TIERS[tier]}\` has no local \`ErrorCode\`. Its success bodies cannot ` +
          '`$ref` `./errors.yaml` — `server/contract/bundle.ts` throws on an external ' +
          'pointer and the whole response schema is dropped, which is precisely the K6 ' +
          'finding. Restore the copy; do not restore the pointer.',
      )

      const drift = mirrorDrift(authority, copy)
      assert.ok(
        clean(drift),
        `THE \`ErrorCode\` MIRROR IN \`${TIERS[tier]}\` HAS DRIFTED FROM \`errors.yaml\`.\n` +
          `  in errors.yaml, missing from the copy: ${drift.missingFromCopy.join(', ') || '(none)'}\n` +
          `  in the copy, not in errors.yaml:       ${drift.notInAuthority.join(', ') || '(none)'}\n` +
          `  same set, different order:             ${String(drift.reordered)}\n` +
          '`errors.yaml` is the AUTHORITY and this file is the MIRROR. Regenerate the copy ' +
          'rather than editing it by hand, and do not edit `errors.yaml` to match a copy.',
      )
    }

    console.error(
      `  §1 · ${String(authority?.length)} error codes mirrored into ` +
        `${String(MIRRORS.length)} documents, in order: ${MIRRORS.join(', ')}.`,
    )
  })

  it('1a · RED — a member added to `errors.yaml` and not to the copy', () => {
    const drift = mirrorDrift(['a', 'b', 'c'], ['a', 'c'])
    assert.deepEqual(drift.missingFromCopy, ['b'])
    assert.deepEqual(drift.notInAuthority, [])
    assert.equal(clean(drift), false, 'the instrument called a one-member gap clean')
  })

  it('1b · RED — a member in the copy that `errors.yaml` does not have, and a reordering', () => {
    const invented = mirrorDrift(['a', 'b'], ['a', 'b', 'zz'])
    assert.deepEqual(invented.notInAuthority, ['zz'])
    assert.equal(clean(invented), false, 'the instrument called an invented member clean')

    /* ⚠️ THE THIRD RED. Equal sets, different order — `check-wire-mirror`'s
     * reason: a reordering is the shape that hides the next insertion. */
    const shuffled = mirrorDrift(['a', 'b'], ['b', 'a'])
    assert.deepEqual(shuffled.missingFromCopy, [])
    assert.deepEqual(shuffled.notInAuthority, [])
    assert.equal(shuffled.reordered, true)
    assert.equal(clean(shuffled), false, 'the instrument called a reordering clean')

    /* AND THE ANTI-VACUITY ARM: an identical pair must be clean, or the three
     * reds above are satisfied by a function that always refuses. */
    assert.equal(clean(mirrorDrift(['a', 'b'], ['a', 'b'])), true)
  })

  it('1c · the set of documents carrying a copy is derived, never transcribed', () => {
    const carrying = (Object.keys(TIERS) as TierName[]).filter(
      (t) => t !== AUTHORITY && enumOf(loadTier(t), 'ErrorCode') !== null,
    )
    assert.deepEqual(
      [...carrying].sort(),
      [...MIRRORS].sort(),
      'THE SET OF DOCUMENTS CARRYING A LOCAL `ErrorCode` HAS CHANGED.\n' +
        `  measured: ${[...carrying].sort().join(', ') || '(none)'}\n` +
        `  recorded: ${[...MIRRORS].sort().join(', ')}\n` +
        'A copy this file does not know about is mirrored by nothing, which is the fork ' +
        'the cost paragraph of the 21 Sep 2026 ruling exists to prevent. Add it to `MIRRORS`.',
    )
  })

  /* ================================================================ *
   * §2 · THE TOTAL PROPERTY — AN ABSENCE, NOT A CENSUS.
   * ================================================================ */

  it('2 · NO success body in ANY tier reaches `errors.yaml`', () => {
    const offenders: string[] = []
    for (const tier of Object.keys(TIERS) as TierName[]) {
      for (const hit of externalRefsInSuccessBodies(loadTier(tier))) {
        if (!hit.ref.includes('errors.yaml')) continue
        offenders.push(`${TIERS[tier]} ${hit.operationId} ${hit.at} -> ${hit.ref}`)
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'A SUCCESS BODY POINTS AT `errors.yaml` AGAIN.\n' +
        `${offenders.map((o) => `  ${o}`).join('\n')}\n` +
        'That pointer makes the WHOLE response schema unbundlable, so the operation is ' +
        'mounted with NO serialiser and a missing `required` field is published silently. ' +
        'This is the K6 finding returning. The repair is a local `#/components/schemas/' +
        'ErrorCode` — every tier that needs one already has one, and §1 mirrors it.',
    )
  })

  /* ================================================================ *
   * §3 · EVERY SUCCESS BODY BUNDLES — THE PROPERTY, WITHOUT A PLANE.
   * ================================================================ */

  it('3 · every declared success body in every tier bundles to a serialiser', () => {
    const failures: string[] = []
    let bundled = 0
    for (const tier of Object.keys(TIERS) as TierName[]) {
      const doc = loadTier(tier)
      for (const declared of declaredSuccesses(doc)) {
        if (declared.schema === null) continue
        if (EXTERNAL_BY_ARGUMENT.has(declared.operationId)) continue
        try {
          bundleSchema(doc, declared.schema as JsonValue)
          bundled += 1
        } catch (error) {
          failures.push(
            `${TIERS[tier]} ${declared.operationId} (${declared.status}): ` +
              (error instanceof Error ? error.message : String(error)),
          )
        }
      }
    }

    assert.deepEqual(
      failures,
      [],
      'A DECLARED SUCCESS BODY DOES NOT BUNDLE, SO IT WOULD MOUNT WITH NO SERIALISER.\n' +
        `${failures.map((f) => `  ${f}`).join('\n')}\n` +
        'Fastify falls back to `JSON.stringify` for such a route: a missing `required` ' +
        'field is published silently and an undeclared key is not stripped. Either give ' +
        'the tier a local copy of what the pointer reaches, or hold the operation out in ' +
        '`EXTERNAL_BY_ARGUMENT` with an argument — and holding it out costs a red in ' +
        '`tests/http/required-fields-served.test.ts` §2 the moment it is mounted.',
    )

    /* ANTI-VACUITY: a run in which nothing bundled would pass the assertion
     * above and prove nothing at all. */
    assert.ok(
      bundled > 100,
      `only ${String(bundled)} success bodies bundled. The whole claim of this file is that ` +
        'they all do; a small number means the walk found almost nothing and the green ' +
        'above is about an empty set.',
    )

    console.error(
      `  §3 · ${String(bundled)} declared success bodies bundle; ` +
        `${String(EXTERNAL_BY_ARGUMENT.size)} held out by name.`,
    )
  })

  it('3a · the held-out operations are still held out for the reason recorded', () => {
    for (const [operationId] of EXTERNAL_BY_ARGUMENT) {
      const hits: ExternalHit[] = []
      for (const tier of Object.keys(TIERS) as TierName[]) {
        hits.push(
          ...externalRefsInSuccessBodies(loadTier(tier)).filter((h) => h.operationId === operationId),
        )
      }
      assert.ok(
        hits.length > 0,
        `\`${operationId}\` is held out of §3 and no longer reaches an external pointer. ` +
          'That is the GOOD direction and it still fails, because the row is now stale: ' +
          'delete it from `EXTERNAL_BY_ARGUMENT` in the commit that repaired it.',
      )
      for (const hit of hits) {
        assert.ok(
          !hit.ref.includes('errors.yaml'),
          `\`${operationId}\` is held out of §3 on the stated ground that its pointer is ` +
            `NOT the error taxonomy, and it reaches ${hit.ref}. §2 is the assertion that ` +
            'governs an `errors.yaml` pointer, and a held-out row must not be how one hides.',
        )
      }
    }
  })

  /* ================================================================ *
   * §4 · THE BUNDLER'S REFUSAL IS INTACT — THE RULING'S OTHER HALF.
   * ================================================================ */

  it('4 · `bundle.ts` still throws on an external pointer, which the ruling requires', () => {
    const doc = loadTier('capability')

    assert.throws(
      () => bundleSchema(doc, { $ref: './errors.yaml#/components/schemas/ErrorCode' }),
      ExternalRefError,
      'THE BUNDLER STOPPED REFUSING EXTERNAL POINTERS.\n' +
        'The 21 Sep 2026 ruling says in its own words that `bundle.ts` is NOT changed. ' +
        'Teaching it to inline `errors.yaml` was one of the three repairs K6 named and it ' +
        'is the one the owner did not take: it widens what the ROUTER accepts, and the ' +
        'refusal is a stated property — silently dropping an unresolvable `$ref` produces ' +
        'a schema that validates LESS than the contract says, which is the §5.6 shape ' +
        'arriving through an error nobody handled.',
    )

    /* AND THE REPAIRED FORM BUNDLES, or the throw above is about something else. */
    const bundledLocal = bundleSchema(doc, { $ref: '#/components/schemas/ErrorCode' })
    assert.ok(
      '$defs' in bundledLocal,
      'the local pointer bundled without pulling `ErrorCode` into `$defs`, so the first arm of §4 ' +
        'arm is not measuring the difference this slice made.',
    )
  })

  /* ================================================================ *
   * §5 · THE MEASUREMENT THAT REFUSED A NARROWER COPY.
   * ================================================================ */

  it('5 · a `oneOf`-nested enum IS enforced at serialisation; a bare one is NOT', async () => {
    /**
     * 🛑 THE ARM NO DOCUMENT HERE HAD NAMED, AND IT IS WHY THE COPY IS 88 AND
     * NOT 5. K6 measured that `fast-json-stringify` is loud when a `required`
     * property is ABSENT and silent when one is present-but-wrong. It did not
     * measure `enum`, and the two forms in these contracts behave DIFFERENTLY:
     *   `blockedBy[]`      — `items: { $ref: … }`, a BARE enum      -> SILENT
     *   `unavailableFor`   — `oneOf: [{ $ref: … }, {type: 'null'}]` -> THROWS
     * A narrowed copy is therefore safe on the first and a **500 in
     * production** on the second the day a producer emits a sixth code. That
     * asymmetry is the deciding fact in the header's reason (2), and it is
     * pinned here so the commit that proposes narrowing meets it.
     */
    const { default: build } = await import('fast-json-stringify')

    const bare = build({
      type: 'object',
      additionalProperties: false,
      required: ['blockedBy'],
      properties: { blockedBy: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } } },
    })
    assert.equal(
      bare({ blockedBy: ['not_a_member'] } as never),
      '{"blockedBy":["not_a_member"]}',
      'a BARE enum started being enforced at serialisation. That is the good direction ' +
        'and it still fails, because reason (2) in the header of this file rests on the ' +
        'asymmetry — re-measure both arms and re-argue the narrowing question.',
    )

    /* ⚠️ THE CAST IS THE MEASUREMENT AND NOT A CONVENIENCE.
     * `fast-json-stringify`'s own TypeScript types do NOT admit `oneOf` at a
     * property position — `ObjectProperties` is `Partial<Schema>` and `oneOf`
     * is not on it — so `tsc` refuses the exact shape
     * `AvailableDisposition.unavailableFor` has been declared as since it was
     * written, and which the serialiser then enforces at RUN TIME. The types
     * are narrower than the library. Cast once, here, rather than changing the
     * shape under test into one the contract does not use. */
    const nestedSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['unavailableFor'],
      properties: {
        unavailableFor: { oneOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }] },
      },
    } as unknown as Parameters<typeof build>[0]
    const nested = build(nestedSchema)
    assert.equal(nested({ unavailableFor: 'a' } as never), '{"unavailableFor":"a"}')
    assert.equal(nested({ unavailableFor: null } as never), '{"unavailableFor":null}')
    assert.throws(
      () => nested({ unavailableFor: 'not_a_member' } as never),
      'a `oneOf`-nested enum stopped being enforced. The 500 that the header of this file calls the ' +
        'cost of a narrowed copy is no longer reachable — which changes the narrowing ' +
        'argument and must be re-put rather than assumed.',
    )

    console.error(
      '  §5 · bare `enum` NOT enforced; `oneOf`-nested `enum` THROWS. ' +
        'The copy stays at full width for that reason.',
    )
  })

  /* ================================================================ *
   * §6 · THE ADDITIVE ARM K6 NAMED AND DID NOT CENSUS.
   * ================================================================ */

  it('6 · no `required` property carries a schema `default` — the silent-publish escape', () => {
    /**
     * ⚠️ K6's HEADER MEASURED THAT A `required` PROPERTY WITH A `default` IS
     * PUBLISHED SILENTLY RATHER THAN THROWING, AND NAMED THAT AS AN ESCAPE
     * WITHOUT MEASURING THE CORPUS. This is that measurement. A `default` on a
     * `required` property converts the one runtime enforcement this repository
     * has — the 500 — into an INVENTED VALUE on the wire, which is
     * `exception-store.ts`'s refused *"no explanation recorded"* arriving
     * through the schema instead of through the store.
     *
     * 🛑 IT IS REPORTED, AND ON THIS TREE IT IS EMPTY. A non-empty result is
     * not this slice's to fix — each entry would be a contract decision — so
     * the assertion names what to do rather than assuming the answer.
     */
    const found: string[] = []
    for (const tier of Object.keys(TIERS) as TierName[]) {
      const doc = loadTier(tier)
      const walk = (node: JsonValue, at: string): void => {
        if (node === null || typeof node !== 'object') return
        if (Array.isArray(node)) {
          for (const n of node) walk(n, at)
          return
        }
        const obj = node as Record<string, JsonValue>
        const required = obj['required']
        const properties = obj['properties']
        if (
          Array.isArray(required) &&
          properties !== null &&
          typeof properties === 'object' &&
          !Array.isArray(properties)
        ) {
          for (const name of required) {
            if (typeof name !== 'string') continue
            const prop = (properties as Record<string, JsonValue>)[name]
            if (prop === null || typeof prop !== 'object' || Array.isArray(prop)) continue
            if ('default' in (prop as Record<string, JsonValue>)) {
              found.push(`${TIERS[tier]} ${at}.${name}`)
            }
          }
        }
        for (const [k, v] of Object.entries(obj)) walk(v, `${at}/${k}`)
      }
      walk(doc['components'] ?? null, 'components')
      walk(doc['paths'] ?? null, 'paths')
    }

    assert.deepEqual(
      found,
      [],
      'A `required` PROPERTY CARRIES A SCHEMA `default`.\n' +
        `${found.map((f) => `  ${f}`).join('\n')}\n` +
        'At `fast-json-stringify@7.0.1` an absent `required` property THROWS — which is ' +
        'the only runtime enforcement in this repository — UNLESS it has a `default`, in ' +
        'which case the default is published silently and the caller cannot tell an ' +
        'answer from an invention. If the default is genuinely the right answer, the ' +
        'property is not `required`-with-a-hole, it is a value the STORE should supply; ' +
        'and if the store cannot supply it, the `unpublishable` in `exception-store.ts` is the ' +
        'shape, not a schema default. Each entry is a contract decision — report it, do ' +
        'not silence it here.',
    )

    console.error('  §6 · `default`-on-`required` census: 0 across all seven tiers.')
  })
})
