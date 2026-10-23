import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalise } from '../../model/canonical.ts'

/**
 * RFC 8785 (JCS). G20 chose it on 7 Aug 2026 and it has been the oldest item in
 * the record with a HARD DEADLINE ever since: `RecordChain` is a linked list of
 * hashes, so the first row written binds every later row to whatever scheme was
 * in effect. Changing it afterwards means re-hashing history — rewriting the
 * records the chain exists to prove were not rewritten.
 *
 * These vectors are written from the SPECIFICATION, not from running the
 * implementation. A vector produced by running the code under test is a
 * change-detector, not a test.
 */

function ok(value: unknown): string {
  const r = canonicalise(value)
  assert.equal(r.ok, true, `expected ok, got ${JSON.stringify(r)}`)
  if (!r.ok) throw new Error('unreachable')
  return r.json
}

test('test_object_keys_are_sorted_by_utf16_code_unit_not_by_insertion_order', () => {
  assert.equal(ok({ b: 1, a: 2 }), '{"a":2,"b":1}')
  /* Capitals sort BEFORE lowercase in UTF-16, which locale-aware sorting gets
   * wrong — the exact discrepancy that would make two implementations disagree. */
  assert.equal(ok({ a: 1, B: 2 }), '{"B":2,"a":1}')
  assert.equal(ok({ 'é': 1, z: 2 }), '{"z":2,"é":1}')
})

test('test_array_order_is_preserved_and_never_sorted', () => {
  assert.equal(ok([3, 1, 2]), '[3,1,2]')
  assert.equal(ok({ k: ['b', 'a'] }), '{"k":["b","a"]}')
})

test('test_nested_objects_are_sorted_at_every_depth', () => {
  assert.equal(ok({ b: { d: 1, c: 2 }, a: 3 }), '{"a":3,"b":{"c":2,"d":1}}')
})

test('test_numbers_use_ecmascript_serialisation_so_1_0_and_1_are_the_same_bytes', () => {
  assert.equal(ok(1.0), '1')
  assert.equal(ok(4.5), '4.5')
  assert.equal(ok(1e30), '1e+30')
  assert.equal(ok(0.002), '0.002')
  assert.equal(ok(-0), '0', 'negative zero canonicalises to 0 — JCS has one zero')
})

test('test_there_is_no_insignificant_whitespace_anywhere', () => {
  assert.equal(ok({ a: [1, { b: 2 }] }), '{"a":[1,{"b":2}]}')
})

test('test_strings_escape_minimally_and_do_not_escape_non_ascii', () => {
  assert.equal(ok('\n'), '"\\n"')
  assert.equal(ok(''), '"\\u000f"')
  assert.equal(ok('€'), '"€"', 'JCS output is UTF-8; non-ASCII is NOT backslash-u escaped')
  assert.equal(ok('"\\'), '"\\"\\\\"')
})

test('test_a_bigint_is_REFUSED_and_not_silently_serialised', () => {
  /* G111: exactly one money codec owns the representation, and it converts
   * `bigint` to a decimal STRING before anything hashes it. A canonicaliser that
   * invented a bigint serialisation would be a SECOND answer to how money is
   * represented — the section 5.3 shape, on the bytes an audit chain signs. */
  const r = canonicalise({ amountMinor: 10n })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.refusal.kind, 'unsupported_type')
  assert.equal(r.refusal.path, '/amountMinor')
})

test('test_non_finite_numbers_are_REFUSED_by_name_and_by_path', () => {
  const cases: readonly (readonly [string, number])[] = [
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['NegInfinity', -Infinity],
  ]
  for (const [label, v] of cases) {
    const r = canonicalise({ deep: { [label]: v } })
    assert.equal(r.ok, false, `${label} must be refused`)
    if (r.ok) return
    assert.equal(r.refusal.kind, 'non_finite_number')
    assert.equal(r.refusal.path, `/deep/${label}`)
  }
})

test('test_undefined_and_functions_are_REFUSED_rather_than_dropped', () => {
  /* JSON.stringify DROPS an undefined-valued key silently. Dropping a key
   * changes the hash while looking like it changed nothing, so a record that
   * lost a field verifies as a different record with no error anywhere. */
  const r = canonicalise({ a: 1, b: undefined })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.refusal.kind, 'unsupported_type')
  assert.equal(r.refusal.path, '/b')
})

test('test_a_cycle_is_REFUSED_rather_than_overflowing_the_stack', () => {
  const a: Record<string, unknown> = {}
  a['self'] = a
  const r = canonicalise(a)
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.refusal.kind, 'cycle')
})

test('test_two_objects_differing_only_in_key_order_produce_the_same_bytes', () => {
  /* THE PROPERTY THE WHOLE MODULE EXISTS FOR. Written as a behaviour rather than
   * a restatement of the sort: this is what makes an anchored chain head
   * comparable between two independent implementations under BYOA. */
  const builtOneWay = { tenantId: 't', action: 'read', at: '2026-08-09T00:00:00Z' }
  const builtAnother = { at: '2026-08-09T00:00:00Z', tenantId: 't', action: 'read' }
  assert.equal(ok(builtOneWay), ok(builtAnother))
  assert.notEqual(
    JSON.stringify(builtOneWay),
    JSON.stringify(builtAnother),
    'and JSON.stringify does NOT have this property — which is why this module exists',
  )
})
