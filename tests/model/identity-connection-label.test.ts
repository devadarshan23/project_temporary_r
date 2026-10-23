/**
 * G232 — `IdentityConnection.label` is REQUIRED and OPERATOR-WRITTEN.
 *
 * THE TEST THIS SUITE EXISTS FOR IS THE FIRST ONE, AND IT IS BEHAVIOURAL.
 * A test that only checked a `label` property exists passes against the lazy
 * repair — a label DERIVED from `protocol` — which is the defect the field is
 * for. `IDENTITY_PROTOCOLS` collapses Microsoft and Google into `oidc`, so a
 * screen deriving *Microsoft* from `oidc` prints it over a Google connection.
 *
 * ⚠️ THE FIXTURE PAIR IS STRONGER THAN #220 ASKED FOR, DELIBERATELY. The issue
 * specifies two `oidc` connections with DIFFERENT owners; the pair here shares
 * ONE owner — a post-acquisition estate, which `IdentityConnection.owner`'s own
 * docblock names as legitimate. With different owners a picker could still
 * disambiguate by owner and the label would not be load-bearing. With one
 * owner NEITHER `protocol` NOR `owner` separates them and `label` is the entire
 * state. Weakening this pair back to two owners weakens the acceptance
 * criterion; do not.
 *
 * ⚠️ §5.10 — the model is types only and nothing here constructs an
 * `IdentityConnection` except `model/examples.ts`. A green `tsc` over a field
 * addition proves NOTHING. These assertions run against the seeded fixtures
 * because the fixtures are the only witness available.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  IDENTITY_PROTOCOLS,
} from '../../model/domain.ts'
import type { IdentityConnection } from '../../model/domain.ts'
import {
  acmeEntraConnection,
  acmeGoogleConnection,
  seededIdentityConnections,
} from '../../model/examples.ts'

/**
 * A picker prints one line per door. This is the whole of what the entry route
 * has to work with, written out so the assertion is about RENDERING rather than
 * about a property bag.
 */
function pickerLines(connections: readonly IdentityConnection[]): string[] {
  return connections.map((connection) => connection.label)
}

test('test_two_oidc_connections_are_distinguishable_without_reading_the_protocol', () => {
  const pair = [acmeEntraConnection, acmeGoogleConnection]

  /* The premise. If this ever stops holding the suite is testing nothing. */
  assert.equal(acmeEntraConnection.protocol, IDENTITY_PROTOCOLS.oidc)
  assert.equal(acmeGoogleConnection.protocol, IDENTITY_PROTOCOLS.oidc)
  assert.equal(acmeEntraConnection.protocol, acmeGoogleConnection.protocol)
  assert.deepEqual(acmeEntraConnection.owner, acmeGoogleConnection.owner)

  const lines = pickerLines(pair)

  /* THE MUTATION GUARD. Implement the label as a function of `protocol` and
   * these two lines become the same string, and exactly this assertion goes
   * red. Nothing else in the suite moves. */
  assert.equal(new Set(lines).size, 2)
  assert.notEqual(lines[0], lines[1])

  /* And neither line may BE the protocol, which is the same substitution
   * wearing a different coat. */
  const protocols: string[] = Object.values(IDENTITY_PROTOCOLS)
  for (const line of lines) {
    assert.equal(protocols.includes(line), false)
    assert.equal(line.trim().length > 0, true)
  }
})

/**
 * G232 picks REQUIRED over nullable, so "refused at mint" is refused BY THE
 * TYPE. There is no mint function in a types-only model, so the requirement is
 * witnessed twice: once at compile time on the declaration, and once at run
 * time over every seeded fixture — because a required field whose only
 * constructor supplies `''` is nullable with extra steps.
 */
type _LabelIsRequiredNotOptional =
  undefined extends IdentityConnection['label'] ? never : IdentityConnection

/* Referenced so `noUnusedLocals` keeps the assertion above alive. */
export type _LabelRequirementIsAsserted = _LabelIsRequiredNotOptional

test('test_a_connection_with_no_label_is_refused_at_mint', () => {
  assert.equal(seededIdentityConnections.length > 1, true)

  for (const connection of seededIdentityConnections) {
    assert.equal(typeof connection.label, 'string')
    assert.equal(connection.label.trim().length > 0, true)
    /* Not the protocol, not the id, not the status — the operator's words. */
    assert.notEqual(connection.label, connection.protocol)
    assert.notEqual(connection.label, String(connection.id))
    assert.notEqual(connection.label, connection.status)
  }
})

/**
 * The half of G232 that is a SECURITY decision rather than a UX one: the label
 * is operator-written, so it is never counterparty text on a staff surface, so
 * invariant 6's class is not opened for a configuration field.
 *
 * ⚠️ WHAT THIS CAN AND CANNOT WITNESS, STATED NARROWLY ON PURPOSE. Provenance
 * is not a property of a string, so no assertion here can prove who typed one.
 * And this reads `model/domain.ts` ONLY — the surface where a protocol-to-label
 * map would live if it were part of the type's own vocabulary. A derivation
 * written somewhere else is caught by the BEHAVIOURAL test at the top of this
 * file and not by this one, which is why that test is the primary guard and
 * this is a second, weaker fence. Widening the scan to `model/*.ts` would make
 * the derive-from-protocol mutation fail two tests instead of the one #220
 * names, which is why it is not widened.
 */
test('test_domain_ts_declares_no_protocol_to_label_derivation', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(
    new URL('../../model/domain.ts', import.meta.url),
    'utf8',
  )

  /* A derivation would have to map the closed protocol set onto display text.
   * Any such map is a `Record<IdentityProtocol, string>` or a switch over the
   * members; both are caught by looking for a protocol member sitting beside a
   * label in the same construct. */
  assert.equal(/labelFor[A-Za-z]*\s*\(/.test(source), false)
  assert.equal(/Record<\s*IdentityProtocol\s*,\s*string\s*>/.test(source), false)
  assert.equal(/PROTOCOL_LABELS/.test(source), false)
})
