import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONNECTOR_PARAMETER_KINDS, CONNECTOR_PARAMETER_ENFORCEMENT, validateConnectorParameters } from '../../model/connectors.ts'
import type { ConnectorParameter } from '../../model/connectors.ts'

const untagged: ConnectorParameter = {
  name: 'strictHostKeyChecking',
  // @ts-expect-error default-deny: a parameter with no kind is unrepresentable.
  kind: undefined,
  declaredValue: 'no', secret: false, insecureValues: [],
}
const invented: ConnectorParameter = {
  name: 'strictHostKeyChecking',
  // @ts-expect-error a connector may not mint a kind the platform has not published.
  kind: 'host_key_policy',
  declaredValue: 'yes', secret: false, insecureValues: ['no'],
}
test('the type refuses an untagged parameter and an invented kind', () => { assert.equal(untagged.name, invented.name) })
test('every kind carries an enforcement row', () => { for (const kind of Object.values(CONNECTOR_PARAMETER_KINDS)) assert.ok(CONNECTOR_PARAMETER_ENFORCEMENT[kind] !== undefined, kind) })
test('the runtime refuses what the type erased', () => { assert.deepEqual(validateConnectorParameters({ declaredBy: 'inline', parameters: [untagged] }).map((v) => v.rule), ['parameter_kind_missing']) })
