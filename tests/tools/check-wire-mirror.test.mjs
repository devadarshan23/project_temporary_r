/**
 * tools/check-wire-mirror.mjs — the model-versus-wire mirror checker.
 *
 * Every expected member list below is a LITERAL array typed into this file.
 * Nothing here compares one parser's output to the same parser's output: that
 * comparison passes when the parser returns [] for both sides, which is the
 * failure mode a types-only repository cannot otherwise detect.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  PAIRS,
  REPO_ROOT,
  DRIFT,
  UNMIRRORED,
  checkPairs,
  discoverWireFiles,
  modelMembers,
  unionLiterals,
} from '../../tools/check-wire-mirror.mjs'

const FIXTURES = 'tests/tools/fixtures/wire-mirror'
const fixture = (name) => path.join(REPO_ROOT, FIXTURES, name)

const FIXTURE_MODEL = `${FIXTURES}/model-fixture.ts`

/** The fixture union pair: model side is fully under this test's control. */
const fixtureLocationPair = {
  name: 'fixture_location',
  model: { file: FIXTURE_MODEL, source: 'union', name: 'FixtureLocation' },
  wire: { schema: 'FixtureLocation', path: ['properties', 'kind', 'enum'] },
}

/** The fixture const pair. Its wire schema is a bare enum, not a union. */
const fixtureMeterPair = {
  name: 'fixture_meter',
  model: { file: FIXTURE_MODEL, source: 'const', name: 'FIXTURE_METERS' },
  wire: { schema: 'FixtureMeter', path: ['enum'] },
}

/** A pair whose wire schema exists in no file at all. */
const fixtureAbsentPair = {
  name: 'fixture_absent',
  model: { file: FIXTURE_MODEL, source: 'const', name: 'FIXTURE_METERS' },
  wire: { schema: 'NoSuchSchemaIsDefinedAnywhere', path: ['enum'] },
}

/**
 * The fixture pair for the `literal_union` source kind, added 11 Aug 2026.
 *
 * Its model side is a bare union of string literals and its wire side states
 * the vocabulary as an INLINE FLOW MAPPING, which is how the real `Run.status`
 * is written. Both halves of the extension are therefore witnessed here before
 * either is pointed at the tree.
 */
const fixtureRunStatusPair = {
  name: 'fixture_run_status',
  model: { file: FIXTURE_MODEL, source: 'literal_union', name: 'FixtureRunStatus' },
  wire: { schema: 'FixtureRun', path: ['properties', 'status', 'enum'] },
}

const realPair = (name) => {
  const found = PAIRS.find((p) => p.name === name)
  assert.ok(found, `the registry must carry a pair named ${name}`)
  return found
}

// ---------------------------------------------------------------- fixtures

test('test_a_wire_enum_missing_one_model_arm_produces_a_finding_that_names_the_missing_member_string', () => {
  const result = checkPairs({
    pairs: [fixtureLocationPair],
    wireFiles: [fixture('missing-arm.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)

  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.equal(finding.pair, 'fixture_location')
  assert.deepEqual(finding.missing, ['charlie'])
  assert.deepEqual(finding.extra, [])
  assert.ok(
    finding.message.includes('charlie'),
    `the finding must name the missing member string; got: ${finding.message}`,
  )
})

test('test_a_wire_enum_holding_every_model_member_in_a_different_order_is_still_reported_even_though_the_two_sets_are_equal', () => {
  const result = checkPairs({
    pairs: [fixtureLocationPair],
    wireFiles: [fixture('reordered.openapi.yaml')],
  })

  const comparison = result.comparisons[0]
  assert.ok(comparison, 'the pair must have been compared')

  // Both sides carry exactly these three, so a set-equality checker sees no drift.
  assert.deepEqual([...comparison.model].sort(), ['alpha', 'bravo', 'charlie'])
  assert.deepEqual([...comparison.wire].sort(), ['alpha', 'bravo', 'charlie'])
  // And the ORDER differs, which is the whole point.
  assert.deepEqual(comparison.model, ['alpha', 'bravo', 'charlie'])
  assert.deepEqual(comparison.wire, ['charlie', 'alpha', 'bravo'])

  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.missing, [])
  assert.deepEqual(finding.extra, [])
  assert.equal(finding.orderMismatch, true)
  assert.ok(
    /order/i.test(finding.message),
    `the finding must say the order differs; got: ${finding.message}`,
  )
})

test('test_a_wire_enum_carrying_a_member_the_model_never_declares_produces_a_finding_that_names_the_extra_member_string', () => {
  const result = checkPairs({
    pairs: [fixtureLocationPair],
    wireFiles: [fixture('extra-arm.openapi.yaml')],
  })

  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.extra, ['delta'])
  assert.deepEqual(finding.missing, [])
  assert.ok(
    finding.message.includes('delta'),
    `the finding must name the extra member string; got: ${finding.message}`,
  )
})

test('test_a_registered_pair_whose_wire_schema_is_absent_entirely_is_reported_under_an_unmirrored_finding_kind_distinct_from_the_drift_kind', () => {
  assert.notEqual(UNMIRRORED, DRIFT)

  const result = checkPairs({
    pairs: [fixtureAbsentPair],
    wireFiles: [fixture('mirrored.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 0)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, UNMIRRORED)
  assert.equal(finding.pair, 'fixture_absent')
  assert.ok(finding.message.includes('NoSuchSchemaIsDefinedAnywhere'))
})

test('test_the_mirrored_fixture_yields_zero_findings_while_reporting_a_nonzero_count_of_pairs_actually_compared', () => {
  const result = checkPairs({
    pairs: [fixtureLocationPair, fixtureMeterPair],
    wireFiles: [fixture('mirrored.openapi.yaml')],
  })

  assert.deepEqual(result.findings, [])
  // A registry that silently dropped both entries would also report zero findings.
  assert.equal(result.pairsCompared, 2)
  assert.notEqual(result.pairsCompared, 0)
})

// ------------------------------------------------- literal_union, red first

test('test_the_literal_union_source_kind_rejects_a_wire_enum_drifted_against_a_bare_literal_union_naming_both_the_missing_and_the_extra_member', () => {
  // The model side is four bare literals; nothing about it is discriminated.
  assert.deepEqual(modelMembers(fixtureRunStatusPair), [
    'queued',
    'running',
    'completed',
    'failed',
  ])

  const result = checkPairs({
    pairs: [fixtureRunStatusPair],
    wireFiles: [fixture('inline-flow-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.missing, ['completed'])
  assert.deepEqual(finding.extra, ['cancelled'])
  assert.ok(finding.message.includes('completed') && finding.message.includes('cancelled'))
})

// ------------------------------------------- engine_meter (W-10 #202), red first

/**
 * 🛑 THE `engine_meter` PAIR, WITNESSED RED BEFORE IT WAS POINTED AT THE TREE.
 *
 * The 11 Aug 2026 amendment to G109 attaches that condition to every new SOURCE
 * KIND. It is applied here to a new PAIR on an existing kind, because the
 * sentence it rests on — "a source kind with no red fixture is a source kind
 * that has never been shown to fail" — is about evidence rather than about
 * source kinds, and a pair whose only witness is a green run against a correct
 * wire is in exactly that position.
 *
 * The fixture is drifted THREE WAYS at once so that repairing any one of them
 * leaves the run red. Both halves are asserted below: the missing-and-extra
 * finding, and the reordering that survives it.
 */
test('test_the_engine_meter_pair_rejects_a_wire_enum_missing_a_member_and_carrying_one_borrowed_from_the_billing_vocabulary', () => {
  const pair = realPair('engine_meter')

  // The model side is four bare literals, read by the measured reader.
  assert.equal(pair.model.source, 'literal_union')
  assert.deepEqual(modelMembers(pair), [
    'input_tokens',
    'output_tokens',
    'reconciliations_run',
    'exceptions_raised',
  ])

  const result = checkPairs({
    pairs: [pair],
    wireFiles: [fixture('engine-meter-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.missing, ['output_tokens'])
  // ⚠️ THE EXTRA MEMBER IS A REAL MEMBER OF `METERS`, and that is the point of
  // choosing it: the drift this pair most plausibly suffers is somebody widening
  // the engine's four to the billing vocabulary's eight, so the fixture is wrong
  // in the shape the mistake would take rather than in an arbitrary one.
  assert.deepEqual(finding.extra, ['documents_processed'])
})

test('test_the_engine_meter_pair_still_reports_drift_when_only_the_order_of_the_wire_enum_disagrees_with_the_model', () => {
  const pair = realPair('engine_meter')

  // The fixture's remaining drift once the missing and extra members are
  // repaired: `exceptions_raised` and `reconciliations_run` are transposed. This
  // checker compares SEQUENCES because "a reordering is the shape that hides the
  // next insertion", and a fixture whose every defect fell to one repair would
  // stop witnessing that the day somebody made it.
  // ⚠️ THE SUBSTITUTION IS ANCHORED TO THE `enum:` LINE AND NOT TO THE MEMBER
  // NAME. `documents_processed` appears in the fixture's own description too —
  // it explains why that member was chosen — and a bare `String.replace` on the
  // name rewrites the PROSE, leaves the enum untouched, and produces a test that
  // passes or fails for a reason unrelated to what it is named after.
  const source = readFileSync(fixture('engine-meter-drift.openapi.yaml'), 'utf8')
  const reordered = source.replace(
    /^(\s*enum: )\[.*\]$/m,
    '$1[input_tokens, output_tokens, exceptions_raised, reconciliations_run]',
  )
  assert.notEqual(reordered, source, 'the enum line was not found; the fixture shape moved')
  const scratch = path.join(tmpdir(), `engine-meter-reordered-${process.pid}.openapi.yaml`)
  writeFileSync(scratch, reordered, 'utf8')
  try {
    const result = checkPairs({ pairs: [pair], wireFiles: [scratch] })
    assert.equal(result.pairsCompared, 1)
    assert.equal(result.findings.length, 1)
    assert.equal(result.findings[0].kind, DRIFT)
    assert.deepEqual(result.findings[0].missing, [])
    assert.deepEqual(result.findings[0].extra, [])
    assert.match(result.findings[0].message, /DIFFERENT ORDER/)
  } finally {
    rmSync(scratch, { force: true })
  }
})

test('test_the_literal_union_source_kind_reads_a_vocabulary_stated_as_an_inline_flow_mapping_rather_than_a_block_mapping', () => {
  const result = checkPairs({
    pairs: [fixtureRunStatusPair],
    wireFiles: [fixture('inline-flow.openapi.yaml')],
  })

  assert.deepEqual(result.findings, [])
  assert.equal(result.pairsCompared, 1)
  // Not an empty list compared against an empty list: the four members are real.
  assert.deepEqual(result.comparisons[0].wire, ['queued', 'running', 'completed', 'failed'])
})

test('test_the_literal_union_source_kind_throws_on_a_union_it_cannot_parse_rather_than_returning_a_short_or_empty_member_list', () => {
  const text = [
    'export type Discriminated =',
    "  | { kind: 'alpha'; alphaId: string }",
    "  | { kind: 'bravo' }",
    '',
    'export type Derived = (typeof SOMETHING)[keyof typeof SOMETHING]',
    '',
    "export type Fine = 'a' | 'b'",
  ].join('\n')

  // A discriminated union: `unionKinds` would answer, this must refuse.
  assert.throws(() => unionLiterals(text, 'Discriminated'), /not a bare union of string literals/)
  // A `typeof X[keyof typeof X]` alias holds no literals at all — the shape
  // whose empty member list would compare equal to an empty wire and read green.
  assert.throws(() => unionLiterals(text, 'Derived'), /not a bare union of string literals/)
  // And the shape it is for still works.
  assert.deepEqual(unionLiterals(text, 'Fine'), ['a', 'b'])
})

// --------------------------------------------------- pack_keys, red first
//
// G224's pack-key vocabulary. G109's amendment requires a pair to be witnessed
// RED against a deliberately drifted fixture BEFORE it is pointed at the tree,
// and the two fixtures below are that witness. They are separate on purpose:
// where the SETS differ, missing/extra dominate and the ordering never becomes
// the reason for the finding, so an order-only drift needs its own fixture or
// the ordering claim is asserted by nothing.

/** The real pair, looked up by name so the registry is the subject, not a copy. */
const packKeysPair = PAIRS.find((p) => p.name === 'pack_keys')

test('test_the_pack_keys_pair_is_registered_against_the_pack_keys_const_object_rather_than_the_pack_key_type_alias', () => {
  assert.ok(packKeysPair, '`pack_keys` must be a registered pair')
  // `literal_union` against `PackKey` would pass today and stop seeing the
  // object the moment the two disagree, which is the drift it must catch.
  assert.equal(packKeysPair.model.source, 'const')
  assert.equal(packKeysPair.model.name, 'PACK_KEYS')
  assert.equal(packKeysPair.model.file, 'model/domain.ts')

  // A literal list, typed here. Nothing below compares the parser to itself.
  assert.deepEqual(modelMembers(packKeysPair), [
    'finance_ap',
    'kyc_identity',
    'credit_underwriting',
    'medical_records',
  ])
})

test('test_the_pack_keys_pair_rejects_a_wire_enum_that_drops_a_registered_key_and_adds_one_the_platform_never_registered', () => {
  const result = checkPairs({
    pairs: [packKeysPair],
    wireFiles: [fixture('pack-key-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.missing, ['kyc_identity'])
  // `partner_authored` is the exact shape G224 forbids: a key minted outside
  // the platform's pre-registered vocabulary.
  assert.deepEqual(finding.extra, ['partner_authored'])
  assert.ok(
    finding.message.includes('kyc_identity') && finding.message.includes('partner_authored'),
    `the red run must name both members; got: ${finding.message}`,
  )
})

test('test_the_pack_keys_pair_rejects_a_wire_enum_holding_every_registered_key_in_a_different_order_even_though_the_sets_are_equal', () => {
  const result = checkPairs({
    pairs: [packKeysPair],
    wireFiles: [fixture('pack-key-reordered.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  // The distinguishing property: nothing is missing and nothing is extra.
  assert.deepEqual(finding.missing, [])
  assert.deepEqual(finding.extra, [])
  assert.ok(
    /DIFFERENT ORDER/i.test(finding.message),
    `an order-only drift must say so; got: ${finding.message}`,
  )
})

// --------------------------------- G217 and G228, red first
//
// TWO PAIRS LANDED TOGETHER — `pairing_strategy_kinds` (#201 [W-9], G217) and
// `line_finding_refusal_kinds` (#247 [W-12], G228) — and neither may be pointed
// at the tree until it has been watched fail. The G109 amendment of 11 Aug 2026
// makes that non-optional, and the `pack_keys` block above is the shape it takes:
// a set-drift fixture, and — where the ordering claim matters — a second fixture
// that exercises order alone, because where the sets differ missing/extra
// dominate and the ordering never becomes the reason for the finding.

const pairingStrategyPair = PAIRS.find((p) => p.name === 'pairing_strategy_kinds')
const lineFindingRefusalPair = PAIRS.find((p) => p.name === 'line_finding_refusal_kinds')

test('test_the_pairing_strategy_pair_reads_the_declaration_in_the_domain_module_rather_than_the_projection_in_the_engine', () => {
  assert.ok(pairingStrategyPair, '`pairing_strategy_kinds` must be a registered pair')
  // `AmbiguityFinding.strategyKind` is `PairingStrategy['kind']` — a PROJECTION.
  // A pair registered against a restatement compares a copy with itself.
  assert.equal(pairingStrategyPair.model.file, 'model/domain.ts')
  assert.equal(pairingStrategyPair.model.source, 'union')
  assert.equal(pairingStrategyPair.model.name, 'PairingStrategy')

  // A literal list, typed here. Nothing below compares the parser to itself.
  assert.deepEqual(modelMembers(pairingStrategyPair), [
    'exact_identifier',
    'amount_and_date',
    'amount_sum',
    'fuzzy_reference',
  ])
})

test('test_the_pairing_strategy_pair_rejects_a_wire_enum_that_drops_the_subset_sum_strategy_and_adds_one_the_model_never_declared', () => {
  const result = checkPairs({
    pairs: [pairingStrategyPair],
    wireFiles: [fixture('pairing-strategy-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  // `amount_sum` is the ONLY strategy that produces an oversized or exhausted
  // bucket, so a wire without it cannot name the strategy G217's own boundary
  // channel reports on.
  assert.deepEqual(finding.missing, ['amount_sum'])
  assert.deepEqual(finding.extra, ['ml_similarity'])
})

test('test_the_pairing_strategy_pair_rejects_the_four_strategies_in_a_different_order_even_though_the_sets_are_equal', () => {
  const result = checkPairs({
    pairs: [pairingStrategyPair],
    wireFiles: [fixture('pairing-strategy-reordered.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  // The distinguishing property: nothing missing, nothing extra.
  assert.deepEqual(finding.missing, [])
  assert.deepEqual(finding.extra, [])
  assert.ok(
    /DIFFERENT ORDER/i.test(finding.message),
    `an order-only drift must say so; got: ${finding.message}`,
  )
})

test('test_the_line_finding_refusal_pair_rejects_a_wire_enum_that_reintroduces_a_match_group_by_the_back_door', () => {
  assert.ok(lineFindingRefusalPair, '`line_finding_refusal_kinds` must be a registered pair')
  assert.equal(lineFindingRefusalPair.model.file, 'model/reconciliation.ts')
  assert.equal(lineFindingRefusalPair.model.source, 'union')
  assert.deepEqual(modelMembers(lineFindingRefusalPair), [
    'no_such_residue_row',
    'residue_row_not_unique',
  ])

  const result = checkPairs({
    pairs: [lineFindingRefusalPair],
    wireFiles: [fixture('line-finding-refusal-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  assert.deepEqual(finding.missing, ['residue_row_not_unique'])
  // 🛑 `match_group_not_found` PRESUPPOSES A RESIDUE ROW HAS A MATCH GROUP. It
  // does not — that is the whole of MG14 and the reason G228 minted a second row
  // type rather than widening `Exception`. A refusal arm naming a match group is
  // the widening arriving through the wire.
  assert.deepEqual(finding.extra, ['match_group_not_found'])
})

test('test_against_the_real_tree_both_new_pairs_are_COMPARED_and_report_no_drift', () => {
  const result = checkPairs({ pairs: [pairingStrategyPair, lineFindingRefusalPair] })
  assert.equal(result.pairsCompared, 2, 'both pairs must be compared, not `unmirrored`')
  assert.deepEqual(result.findings, [])
})

// ------------------------------------------- G184, red first, in both shapes
//
// `intake_channel_kinds` (#176 [I-1]) is registered in the commit that creates
// the vocabulary, so it is never unwatched — and under the G109 amendment of
// 11 Aug 2026 it may not be pointed at the tree until it has been watched fail.
// It is watched fail twice, because it makes two claims: about the SET, and
// about the ORDER.

const intakeChannelPair = PAIRS.find((p) => p.name === 'intake_channel_kinds')

test('test_the_intake_channel_pair_reads_the_one_vocabulary_in_the_ingestion_module', () => {
  assert.ok(intakeChannelPair, '`intake_channel_kinds` must be a registered pair')
  // The declaration, not a restatement. A pair registered against a copy
  // compares a copy with itself.
  assert.equal(intakeChannelPair.model.file, 'model/ingestion.ts')
  assert.equal(intakeChannelPair.model.source, 'const')
  assert.equal(intakeChannelPair.model.name, 'INTAKE_CHANNEL_KINDS')

  // A literal list, typed here. Nothing below compares the parser to itself.
  assert.deepEqual(modelMembers(intakeChannelPair), [
    'upload',
    'watched_drop',
    'connector_pull',
    'mailbox',
  ])
})

test('test_the_intake_channel_pair_rejects_a_wire_enum_that_drops_a_lane_and_reintroduces_the_dropped_api_member', () => {
  const result = checkPairs({
    pairs: [intakeChannelPair],
    wireFiles: [fixture('intake-channel-drift.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  // `watched_drop` is one of the two lanes the deleted three-value
  // `SourceDocument.origin` collapsed into `connector`. A wire without it
  // cannot attribute an `EndpointHealth` row to the lane that produced it.
  assert.deepEqual(finding.missing, ['watched_drop'])
  // 🛑 `api` IS THE MEMBER G184 DROPS, AND FOLDING IT INTO `upload` IS THE
  // TEMPTING ERROR THE RULING NAMES. A wire carrying it while the model does
  // not is that fold arriving through the contract.
  assert.deepEqual(finding.extra, ['api'])
})

test('test_the_intake_channel_pair_rejects_the_four_lanes_in_a_different_order_even_though_the_sets_are_equal', () => {
  const result = checkPairs({
    pairs: [intakeChannelPair],
    wireFiles: [fixture('intake-channel-reordered.openapi.yaml')],
  })

  assert.equal(result.pairsCompared, 1)
  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, DRIFT)
  // The distinguishing property: nothing missing, nothing extra.
  assert.deepEqual(finding.missing, [])
  assert.deepEqual(finding.extra, [])
  assert.ok(
    /DIFFERENT ORDER/i.test(finding.message),
    `an order-only drift must say so; got: ${finding.message}`,
  )
})

test('test_against_the_real_tree_the_intake_channel_pair_is_COMPARED_and_reports_no_drift', () => {
  const result = checkPairs({ pairs: [intakeChannelPair] })
  assert.equal(result.pairsCompared, 1, 'the pair must be compared, not `unmirrored`')
  assert.deepEqual(result.findings, [])
})

// ---------------------------------------------------------------- real tree

test('test_against_the_real_tree_service_notice_kinds_is_reported_unmirrored_because_no_contract_file_names_it', () => {
  const result = checkPairs({ pairs: [realPair('service_notice_kinds')] })

  assert.equal(result.findings.length, 1)
  const finding = result.findings[0]
  assert.equal(finding.kind, UNMIRRORED)
  assert.equal(finding.pair, 'service_notice_kinds')
  assert.equal(result.pairsCompared, 0)

  // The model side is real and non-empty; the absence is on the wire.
  assert.deepEqual(modelMembers(realPair('service_notice_kinds')), [
    'support_grant_issued',
    'support_grant_extended',
    'support_grant_closed',
    'security_patch_applied',
    'scheduled_maintenance',
    'run_failed',
    'connection_unreachable',
    'posting_failed',
  ])
})

test('test_against_the_real_tree_subject_location_compares_eleven_members_in_model_declaration_order_with_bi_dataset_last', () => {
  const members = modelMembers(realPair('subject_location'))

  assert.deepEqual(members, [
    'source_document',
    'match_group_key',
    'explanation_observed',
    'audit_event',
    'observed_label',
    'score_rationale',
    'blob',
    'correspondence_message',
    'trace',
    'notification',
    'bi_dataset',
  ])
  assert.equal(members.length, 11)
  assert.equal(members[members.length - 1], 'bi_dataset')

  const result = checkPairs({ pairs: [realPair('subject_location')] })
  assert.equal(result.pairsCompared, 1)
  assert.deepEqual(result.comparisons[0].wire, members)
  assert.deepEqual(result.findings, [])
})

test('test_against_the_real_tree_live_policy_kind_resolves_to_six_members_by_subtracting_the_exclude_arguments_from_policy_kinds_and_matches_the_control_plane_required_list_in_order', () => {
  const LIVE_SIX = [
    'autonomy',
    'approval',
    'model_use',
    'managed_service_use',
    'data_egress',
    'correspondence',
  ]

  const members = modelMembers(realPair('live_policy_kind'))
  assert.equal(members.length, 6)
  assert.deepEqual(members, LIVE_SIX)
  // The subtraction actually removed the two dropped kinds.
  assert.ok(!members.includes('spend'))
  assert.ok(!members.includes('content_guardrail'))

  const result = checkPairs({ pairs: [realPair('live_policy_kind')] })
  assert.equal(result.pairsCompared, 1)
  assert.deepEqual(result.comparisons[0].wire, LIVE_SIX)
  assert.deepEqual(result.findings, [])
})

test('test_against_the_real_tree_the_meters_and_retention_classes_pairs_report_zero_findings_proving_the_checker_does_not_flag_a_correctly_mirrored_pair', () => {
  const METERS = [
    'input_tokens',
    'output_tokens',
    'documents_processed',
    'pages_extracted',
    'reconciliations_run',
    'exceptions_raised',
    'storage_gb_month',
    'api_calls',
  ]
  const RETENTION = [
    'source_document',
    'export',
    'page_render',
    'exception',
    'match_group',
    'approval',
    'audit_event',
    'policy_evaluation',
    'usage_record',
    'data_access_event',
    'score_result',
    'observed_label',
    'trace',
    // G233, 23 Aug 2026 — the fourteenth, APPENDED in both the model and the
    // wire. Typed in by hand rather than derived, for the reason this suite
    // states everywhere else: a list compared against its own source passes
    // forever and witnesses nothing.
    'held_work',
  ]

  assert.deepEqual(modelMembers(realPair('meters')), METERS)
  assert.deepEqual(modelMembers(realPair('retention_classes')), RETENTION)

  const result = checkPairs({ pairs: [realPair('meters'), realPair('retention_classes')] })
  assert.deepEqual(result.findings, [])
  assert.equal(result.pairsCompared, 2)
  assert.deepEqual(result.comparisons[0].wire, METERS)
  assert.deepEqual(result.comparisons[1].wire, RETENTION)
})

test('test_against_the_real_tree_run_status_compares_the_five_named_model_states_in_declaration_order_and_reports_no_drift', () => {
  // ⚠️ FIVE UNTIL 4 Oct 2026 — G4033, THE OWNER'S, adds `refused`; the test
  // name still says "five" and is left as the identifier tests cite it by.
  const STATES = ['queued', 'running', 'completed', 'failed', 'incomplete', 'refused']

  // ⚠️ FOUR UNTIL 16 Aug 2026. The comment here read "O-16 adds a third
  // reconciliation OUTCOME and will change this list; that is the whole reason
  // the pair was registered before O-16 rather than after it." IT DID, and the
  // prediction is left standing rather than deleted because it came true and
  // the pair behaved as designed: `incomplete` was added to `RunStatus` alone
  // and `node tools/check-wire-mirror.mjs` reported
  // `run_status … missing from the wire: incomplete` and exited 1, BEFORE
  // either wire copy moved. A pair that has been seen red is a pair that
  // asserts something.
  //
  // 🛑 AND THIS TEST STILL DOES NOT COVER THE SECOND WIRE COPY. The `/runs`
  // `status` query parameter is not a schema and no pair can reach it;
  // `tests/contracts/run-status-wire.test.mjs` is the only thing that does.
  // Verified by mutation on the day O-16 landed: with the `Run` schema correct
  // and the query parameter still four members, this file and the checker were
  // both GREEN.
  assert.deepEqual(modelMembers(realPair('run_status')), STATES)

  const result = checkPairs({ pairs: [realPair('run_status')] })
  assert.equal(result.pairsCompared, 1)
  assert.deepEqual(result.comparisons[0].wire, STATES)
  assert.equal(result.comparisons[0].file, 'docs/contracts/capability.openapi.yaml')
  assert.deepEqual(result.findings, [])
})

test('test_against_the_real_tree_the_pack_keys_pair_reports_zero_findings_and_resolves_to_the_foundation_tier_where_the_enum_is_declared_once', () => {
  const result = checkPairs({ pairs: [packKeysPair] })

  assert.deepEqual(result.findings, [])
  // A registry that silently dropped the entry would also report zero findings.
  assert.equal(result.pairsCompared, 1)

  // The enum is declared ONCE, in the foundation tier. `control-plane` reaches
  // it by a bare `$ref` alias and both `propertyNames` sites reach that alias —
  // a second parallel enum is the thing this pair exists to make impossible.
  const [comparison] = result.comparisons
  assert.ok(
    comparison.file.endsWith('docs/contracts/foundation.openapi.yaml'),
    `expected the foundation tier to be the declaration site; got ${comparison.file}`,
  )
})

// ---------------------------------------------------------------- process

test('test_the_checker_process_exits_one_when_any_drift_finding_is_reported_and_zero_when_none_is', () => {
  const checker = path.join(REPO_ROOT, 'tools', 'check-wire-mirror.mjs')

  // Green: the real tree, every registered pair.
  let greenStatus = null
  let greenOut = ''
  try {
    greenOut = execFileSync(process.execPath, [checker], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    greenStatus = 0
  } catch (err) {
    greenStatus = err.status
    greenOut = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
  assert.equal(greenStatus, 0, `the real tree must exit 0; output was:\n${greenOut}`)

  // Red: the same registered pair, read against a deliberately drifted wire file.
  let redStatus = null
  let redOut = ''
  try {
    redOut = execFileSync(
      process.execPath,
      [
        checker,
        '--pairs',
        'meters',
        '--wire',
        path.join(REPO_ROOT, FIXTURES, 'missing-arm.openapi.yaml'),
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    redStatus = 0
  } catch (err) {
    redStatus = err.status
    redOut = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
  assert.equal(redStatus, 1, `a drift finding must exit 1; output was:\n${redOut}`)
  assert.ok(redOut.includes('api_calls'), `the red run must name the missing member; got:\n${redOut}`)
})

test('test_the_fixtures_directory_is_excluded_from_the_real_tree_scan_so_the_committed_red_fixtures_never_appear_in_a_real_run', () => {
  // The fixtures are real files, really named *.openapi.yaml, and really drifted.
  for (const name of [
    'mirrored.openapi.yaml',
    'missing-arm.openapi.yaml',
    'reordered.openapi.yaml',
    'extra-arm.openapi.yaml',
    'inline-flow.openapi.yaml',
    'inline-flow-drift.openapi.yaml',
    /* W-10 (#202). The `engine_meter` pair's red witness — deleting it would
     * leave the pair proven only by a green run against a correct wire. */
    'engine-meter-drift.openapi.yaml',
    'pack-key-drift.openapi.yaml',
    'pack-key-reordered.openapi.yaml',
    /* G217 (#201) and G228 (#247). Deleting either leaves its pair proven only
     * by a green run against a correct wire, which proves the wire and not the
     * pair. */
    'pairing-strategy-drift.openapi.yaml',
    'pairing-strategy-reordered.openapi.yaml',
    'line-finding-refusal-drift.openapi.yaml',
    /* G184 (#176). Both witnesses, for the same reason: deleting either leaves
     * `intake_channel_kinds` proven only by a green run against a correct wire,
     * which proves the wire and not the pair. */
    'intake-channel-drift.openapi.yaml',
    'intake-channel-reordered.openapi.yaml',
  ]) {
    assert.ok(existsSync(fixture(name)), `${name} must exist for this exclusion to mean anything`)
  }

  const discovered = discoverWireFiles(REPO_ROOT)

  for (const file of discovered) {
    assert.ok(
      !file.split(path.sep).includes('fixtures'),
      `the real-tree scan must not pick up ${file}`,
    )
  }

  const relative = discovered.map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'))
  assert.deepEqual(relative.sort(), [
    /* The SIXTH tier, G288, 19 Sep 2026 — `administration.openapi.yaml`, the
     * partner portal and the staff console. Added here deliberately rather than
     * by widening the assertion, which is what this hard-coded list is for: the
     * header's own cost note says "a new tier cannot land without someone naming
     * it", and it went red exactly as designed.
     * ⚠️ IT DECLARES NONE OF THE 27 REGISTERED PAIR SCHEMAS, and that was
     * checked by NAME rather than assumed — the risk the session tier's note
     * records is that "a schema sharing a pinned schema's name would become a
     * second declaration site and the pair could resolve to the wrong file."
     * `PackKey` is the one that nearly happened: the administration tier needed
     * a pack identifier and declares it as a PATH PARAMETER with no schema, and
     * says so on the parameter. */
    'docs/contracts/administration.openapi.yaml',
    'docs/contracts/capability.openapi.yaml',
    'docs/contracts/control-plane.openapi.yaml',
    /* The FOURTH tier, added 10 Aug 2026. This list is hard-coded on purpose —
     * it is what proves the real-tree scan found the real files and not the
     * fixtures — so a new contract file MUST be added here deliberately. The
     * failure it produced was correct: the scan changed and nobody had said so. */
    'docs/contracts/data-plane-local.openapi.yaml',
    'docs/contracts/foundation.openapi.yaml',
    /* The SEVENTH tier, G781, 19 Sep 2026 — `platform-console.openapi.yaml`,
     * the staff console's gateable half, split out of the administration tier
     * so the operations that HAVE an evaluator can be annotated without
     * putting an `exempt:` on a `true` tier. It went red exactly as designed
     * — a split adds a FILE and no operation, so `check-doc-counts` is
     * structurally silent on it and this hard-coded list is the only control
     * in the gate that noticed the seventh tier at all.
     * ⚠️ IT DECLARES NONE OF THE 27 REGISTERED PAIR SCHEMAS, checked by NAME
     * against `PAIRS` rather than assumed. The one apparent hit was `meters`,
     * 22 times, and every one of them is the substring inside `parameters` —
     * which is §5.1 in the checking itself: a grep keyed on a convenient
     * substring instead of on the property, which is a schema DECLARATION.
     * The derivation that answers it is `grep -nE '^ {4}meters:'`, and it
     * returns nothing. */
    'docs/contracts/platform-console.openapi.yaml',
    /* The FIFTH tier, #230/#231. It went red exactly as designed and is added
     * here deliberately rather than by widening the assertion. ⚠️ It declares
     * NONE of the 24 registered pair schemas, so the pairs are unmoved by it —
     * checked by name, not assumed: a session-tier schema sharing a pinned
     * schema's name would become a second declaration site and the pair could
     * resolve to the wrong file. */
    'docs/contracts/session.openapi.yaml',
  ])
})
