import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO_ROOT, unionKinds, constArrayValues } from '../../tools/check-wire-mirror.mjs'

const reconciliation = readFileSync(join(REPO_ROOT, 'model/reconciliation.ts'), 'utf8')

test('union reader ignores docblock examples', () => {
  assert.equal(unionKinds(reconciliation, 'ToleranceRefusal').length, 3)
})

test('union reader ignores nested field discriminators', () => {
  const kinds = unionKinds(reconciliation, 'SetReconciliationRefusal')
  assert.equal(kinds.length, 15)
  assert.ok(!kinds.includes('pairing'))
  assert.ok(!kinds.includes('strategy_binding'))
})

test('const array reader preserves declaration order', () => {
  assert.equal(constArrayValues(reconciliation, 'POPULATION_DEFECT_KINDS').length, 8)
})
