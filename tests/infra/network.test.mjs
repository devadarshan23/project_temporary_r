/**
 * INVARIANT 3 AT THE NETWORK LAYER, WITNESSED RED.
 *
 * 🛑 WHAT THIS FILE IS DEFENDING, IN THE RECORD'S OWN WORDS. `compose.yaml`
 * enforces the plane boundary with two docker networks — *"`data-plane-db` DOES
 * NOT RESOLVE inside it — not 'is refused', not 'is unauthorised': does not
 * resolve"* — and G193's own row records the uncomfortable half of that:
 *
 *     "THE STRONGEST CLAIMED CONTROL IS THE ONE NOTHING CHECKS … adding
 *      `networks: [control-net, data-net]` to `control-plane` keeps every test
 *      in the suite green."
 *
 * G253 moves that boundary to AWS as two security-group pairs, where one VPC
 * means the hostname DOES resolve and the only thing between the planes is the
 * absence of an ingress rule. **An absence is precisely the class `CLAUDE.md`
 * records the count checker as blind to — "an omission has no number in it" —
 * so this suite asserts it as a positive statement about the synthesised
 * template, and is witnessed failing against two fixtures before it is
 * trusted.** It is the check G193 says did not exist.
 *
 * ⚠️ EVERY EXPECTED VALUE BELOW IS TYPED INTO THIS FILE. Nothing is imported
 * from `infra/lib/`: comparing a control's output to the same constant the
 * control read is a comparison that passes when both sides are empty, which is
 * the warning `tests/infra/tag-aspect.test.mjs` and
 * `tests/tools/check-wire-mirror.test.mjs` both carry at their heads.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 **20 Sep 2026 — G1284: THIS SUITE IS NOW DIRECTIONAL, AND IT GAINS A
 *    SECOND ASSERTION BECAUSE THE FIRST ONE HAD A HOLE.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The amendment.** `assertPlaneBoundaryHolds()`'s arm 2 read
 * `assert.equal(sourceGroup.plane, targetGroup.plane)` — SYMMETRIC — and
 * invariant 3 is not: *"The control plane publishes downward and never reads
 * tenant data."* G1161 gives the DATA plane a read-only pool onto the CONTROL
 * database, which is a downward read by a process that publishes nothing back,
 * and a symmetric assertion would have had to be DELETED to let it through.
 * **A control deleted to make a green is the failure this suite exists to
 * prevent**, so the arm is split instead: one unconditional clause refusing any
 * `Plane=control` source on the tenant database — which no allow-list entry can
 * reach — and one clause requiring every other cross-plane rule to be a pair
 * somebody argued. The permitted set has ONE member.
 *
 * **The hole.** Nothing here asserted HOW MANY sources a database group had, or
 * WHICH. A fourth SAME-PLANE source — the control ALB group in front of the
 * control database — passed every assertion in this file: matching planes,
 * tcp, 5432. `assertControlDatabaseSourcesAreExactlyTheArguedSet()` closes it,
 * and `infra/test-fixtures/control-db-fourth-source.ts` is its red witness —
 * **a fixture this file separately asserts the BOUNDARY check accepts**, so the
 * two assertions are witnessed as different controls rather than one written
 * twice.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const SECURITY_GROUP = 'AWS::EC2::SecurityGroup'
const SECURITY_GROUP_INGRESS = 'AWS::EC2::SecurityGroupIngress'

/** The two groups that protect a database. Typed here, not imported. */
const DATABASE_GROUP_NAMES = ['reconcile-staging-data-db', 'reconcile-staging-control-db']

/**
 * 🛑 THE DATA PLANE'S DATABASE GROUP. NO `Plane=control` SOURCE MAY EVER REACH
 * IT, AND THAT CLAUSE IS NOT EXEMPTIBLE BY THE ALLOW-LIST BELOW.
 *
 * This is invariant 3 in one string — *"The control plane publishes downward
 * and never reads tenant data"* — and it is separated from the allow-list on
 * purpose. An allow-list is a thing people append to; a clause no entry in it
 * can reach is a thing people have to delete, and deleting it is the reviewable
 * act. §5.1 is the defect shape being avoided: a rule keyed on a convenient
 * landmark (*"is this pair in the list?"*) instead of on the property
 * (*"whatever the list says, this direction is forbidden"*).
 */
const TENANT_DATABASE_GROUP_NAME = 'reconcile-staging-data-db'

/**
 * THE ONLY CROSS-PLANE INGRESS THIS APP PERMITS — G1161, G1284, 20 Sep 2026.
 *
 * The data plane reads the CONTROL database read-only, as
 * `reconcile_control_reader`, for the console tenancy roster. It is a DOWNWARD
 * read of a control-owned fact by a process that publishes nothing back, so
 * invariant 3's own sentence is untouched. `infra/lib/network-stack.ts` argues
 * the direction at length and refuses the mirror image by name.
 *
 * ⚠️ TYPED HERE, NOT IMPORTED — the rule this whole file states at its head. A
 * list read from `infra/lib/` would grow by itself every time somebody added a
 * rule, which is the assertion passing because both sides moved together.
 */
const PERMITTED_CROSS_PLANE_INGRESS = [
  /* ⛔ data-tasks → control-db (G1161) RETIRED — G4320, 5 Oct 2026. */
  /**
   * G4310, 5 Oct 2026 — THE OWNER'S "Full restore" RULING. The data plane
   * calls the control plane's INTERNAL tier over its ALB, signed (SigV4 via
   * STS). Data → control, the direction invariant 3 permits; the reverse is
   * still refused by arm 3 above for the tenant database.
   */
  { source: 'reconcile-staging-data-tasks', target: 'reconcile-staging-control-alb' },
]

/**
 * Exactly what may reach the CONTROL database, and nothing else — G1284.
 *
 * ⚠️ THIS SET IS ASSERTED BECAUSE NOTHING ASSERTED IT BEFORE. The suite already
 * checked the PORT and the PROTOCOL of every database rule and the PLANE of
 * every source; it never checked HOW MANY sources a database group has or WHICH
 * ones. A fourth same-plane source — the control ALB group, say, in front of a
 * database proxy — was therefore invisible to every assertion in this file, and
 * the G1284 rule makes this group the one somebody will next reach for.
 */
const CONTROL_DATABASE_SOURCES = [
  'reconcile-staging-control-tasks',
  'reconcile-staging-control-rotation',
  /* ⛔ `reconcile-staging-data-tasks` (G1161) RETIRED — G4320, 5 Oct 2026, THE
     OWNER'S "Full restore" ruling. Same-plane sources only, again. */
]

// --------------------------------------------------------------- the engine

/**
 * Index every security group in every template by logical id.
 *
 * A group is identified by its `Plane` TAG rather than by its name, because the
 * tag is what G260 says invariant 3 is audited from and a name is a string
 * somebody can make say anything. A group with no `Plane` tag is a failure
 * here, not a skip.
 */
function indexSecurityGroups(templates) {
  const byLogicalId = new Map()
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, SECURITY_GROUP)) {
      const tags = resource.Properties?.Tags ?? []
      const plane = tags.find((t) => t.Key === 'Plane')?.Value
      byLogicalId.set(logicalId, {
        stackName,
        logicalId,
        plane,
        groupName: resource.Properties?.GroupName,
      })
    }
  }
  return byLogicalId
}

/**
 * Map every cross-stack export back to the logical id it exports, so an
 * `Fn::ImportValue` can be resolved to a security group rather than shrugged at.
 */
function indexExports(templates) {
  const byExportName = new Map()
  for (const template of Object.values(templates)) {
    for (const output of Object.values(template.Outputs ?? {})) {
      const name = output.Export?.Name
      if (typeof name !== 'string') continue
      const getAtt = output.Value?.['Fn::GetAtt']
      if (Array.isArray(getAtt)) byExportName.set(name, getAtt[0])
      else if (typeof output.Value?.Ref === 'string') byExportName.set(name, output.Value.Ref)
    }
  }
  return byExportName
}

/**
 * Resolve a template reference to a security group's logical id.
 *
 * 🛑 AN UNRESOLVABLE REFERENCE RETURNS A DISTINCT `unresolved` RESULT AND THE
 * CALLER FAILS ON IT. The tempting shape is to return `undefined` and let the
 * caller skip; that is how this control would silently die the day CDK renders
 * a group reference some other way — the assertion would pass over every rule
 * and report nothing. A reference this file cannot read is a test failure
 * asking somebody to extend it.
 */
function resolveGroupRef(ref, exportsByName) {
  if (typeof ref === 'string') return { kind: 'literal', value: ref }
  if (ref === null || typeof ref !== 'object') return { kind: 'unresolved', value: ref }
  const getAtt = ref['Fn::GetAtt']
  if (Array.isArray(getAtt)) return { kind: 'logicalId', value: getAtt[0] }
  if (typeof ref.Ref === 'string') return { kind: 'logicalId', value: ref.Ref }
  const imported = ref['Fn::ImportValue']
  if (typeof imported === 'string' && exportsByName.has(imported)) {
    return { kind: 'logicalId', value: exportsByName.get(imported) }
  }
  return { kind: 'unresolved', value: ref }
}

/** Every ingress rule in every template — standalone resources AND inline ones. */
function allIngressRules(templates) {
  const rules = []
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, SECURITY_GROUP_INGRESS)) {
      rules.push({ stackName, logicalId, target: resource.Properties?.GroupId, rule: resource.Properties ?? {} })
    }
    /* CDK INLINES a rule into the group's own `SecurityGroupIngress` property
     * whenever it can, and creates a separate resource only when it cannot.
     * Reading one form and not the other is a control that works until somebody
     * changes a peer type. */
    for (const [logicalId, resource] of resourcesOfType(template, SECURITY_GROUP)) {
      for (const inline of resource.Properties?.SecurityGroupIngress ?? []) {
        rules.push({ stackName, logicalId, target: { 'Fn::GetAtt': [logicalId, 'GroupId'] }, rule: inline })
      }
    }
  }
  return rules
}

/**
 * THE ASSERTION. It throws; both the real app and the two red fixtures are run
 * through THIS function, so the fixtures witness this code rather than a
 * paraphrase of it.
 */
function assertPlaneBoundaryHolds(templates) {
  const groups = indexSecurityGroups(templates)
  const exportsByName = indexExports(templates)
  const rules = allIngressRules(templates)

  assert.ok(groups.size > 0, 'no security groups found at all; this assertion would pass vacuously')
  assert.ok(rules.length > 0, 'no ingress rules found at all; this assertion would pass vacuously')

  for (const [, group] of groups) {
    assert.ok(
      typeof group.plane === 'string' && group.plane.length > 0,
      `security group ${group.stackName}/${group.logicalId} carries no Plane tag, so no ` +
        'tag query can decide whether a rule on it crosses the boundary (G260)',
    )
  }

  for (const entry of rules) {
    const target = resolveGroupRef(entry.target, exportsByName)
    assert.notEqual(
      target.kind,
      'unresolved',
      `ingress rule ${entry.stackName}/${entry.logicalId} names its target group in a form ` +
        `this test cannot read (${JSON.stringify(entry.target)}). Extend resolveGroupRef; ` +
        'do not let it skip.',
    )
    const targetGroup = groups.get(target.value)
    if (targetGroup === undefined) continue // a group in an account, not in this app

    const isDatabaseGroup = DATABASE_GROUP_NAMES.includes(targetGroup.groupName)

    // ---- arm 1: no CIDR may reach a database group
    if (isDatabaseGroup) {
      assert.equal(
        entry.rule.CidrIp ?? entry.rule.CidrIpv6 ?? null,
        null,
        `${targetGroup.groupName} admits a CIDR range (${entry.rule.CidrIp ?? entry.rule.CidrIpv6}). ` +
          'A CIDR rule admits whatever lands in that range next, including the other ' +
          "plane's tasks. Name a security group, not an address range.",
      )
    }

    // ---- arm 2: no rule may join one plane's source to another plane's target
    const sourceRef = entry.rule.SourceSecurityGroupId
    if (sourceRef === undefined) continue
    const source = resolveGroupRef(sourceRef, exportsByName)
    assert.notEqual(
      source.kind,
      'unresolved',
      `ingress rule ${entry.stackName}/${entry.logicalId} names its SOURCE group in a form ` +
        `this test cannot read (${JSON.stringify(sourceRef)}). Extend resolveGroupRef.`,
    )
    const sourceGroup = groups.get(source.value)
    if (sourceGroup === undefined) continue

    /**
     * ---- arm 3: THE FORBIDDEN DIRECTION, and it is checked FIRST and
     * unconditionally.
     *
     * No control-plane source reaches the tenant database, whatever any
     * allow-list says. This arm is deliberately unreachable by
     * `PERMITTED_CROSS_PLANE_INGRESS` so that widening that list cannot open
     * this direction by accident.
     */
    if (targetGroup.groupName === TENANT_DATABASE_GROUP_NAME) {
      assert.notEqual(
        sourceGroup.plane,
        'control',
        `INVARIANT 3: ${sourceGroup.groupName} (Plane=control) is admitted to ` +
          `${targetGroup.groupName} on port ${entry.rule.FromPort}. This is the direction ` +
          'the invariant forbids outright - "the control plane publishes downward and never ' +
          'reads tenant data" - and NO entry in PERMITTED_CROSS_PLANE_INGRESS may authorise ' +
          'it. G253: "no rule admits control-plane tasks to the data cluster".',
      )
    }

    /**
     * ---- arm 4: every OTHER cross-plane rule must be one this app argued.
     *
     * 🛑 THIS ARM READ `assert.equal(sourceGroup.plane, targetGroup.plane)`
     * UNTIL 20 Sep 2026 AND IS AMENDED RATHER THAN DELETED — G1284. The old
     * form was SYMMETRIC and invariant 3 is DIRECTIONAL: it forbids the control
     * plane reading tenant data, and says nothing against the data plane
     * reading a control-owned fact downward. G1161 opened exactly one such
     * edge, and a symmetric assertion would have had to be deleted to let it
     * through - which is how a control gets removed to make a green.
     *
     * **What is kept is the scarcity, not the symmetry**: the permitted set is
     * ONE pair, typed above, and any other cross-plane rule is still red. A
     * second edge has to be argued into that list by a person, in a diff.
     */
    if (sourceGroup.plane !== targetGroup.plane) {
      const permitted = PERMITTED_CROSS_PLANE_INGRESS.some(
        (p) => p.source === sourceGroup.groupName && p.target === targetGroup.groupName,
      )
      assert.ok(
        permitted,
        `CROSS-PLANE INGRESS: ${sourceGroup.groupName} (Plane=${sourceGroup.plane}) is ` +
          `admitted to ${targetGroup.groupName} (Plane=${targetGroup.plane}) on port ` +
          `${entry.rule.FromPort}, and that pair is not in PERMITTED_CROSS_PLANE_INGRESS. ` +
          'G193: the plane boundary is enforced by TOPOLOGY, not by review. If this edge is ' +
          'genuinely wanted, argue it in infra/lib/network-stack.ts and add it here - do not ' +
          'widen the assertion.',
      )
    }
  }
}

/**
 * THE SECOND ASSERTION — G1284. **The CONTROL database admits exactly the three
 * sources this app argues for, and no fourth.**
 *
 * 🛑 WHY THIS IS NOT COVERED BY `assertPlaneBoundaryHolds()`, WHICH IS THE
 * WHOLE REASON IT EXISTS. That function asks, of each rule, *is this source's
 * plane allowed to reach this target's plane* — so it is silent on a FOURTH
 * SAME-PLANE SOURCE. `reconcile-staging-control-alb` admitted to
 * `reconcile-staging-control-db` is `Plane=control` reaching `Plane=control`:
 * every existing arm in this file passes it, the port is 5432, the protocol is
 * tcp, and a load balancer would be able to reach the database directly. **The
 * count and the identity of the sources were asserted by nothing.**
 *
 * G1161's new rule is what makes that gap worth closing now rather than later:
 * this group has just become the one an engineer reaches for when something
 * needs to talk to the control database, and the precedent on its face reads
 * like permission.
 *
 * It throws; both the real app and the red fixture run through THIS function,
 * so the fixture witnesses this code rather than a paraphrase of it.
 */
function assertControlDatabaseSourcesAreExactlyTheArguedSet(templates) {
  const groups = indexSecurityGroups(templates)
  const exportsByName = indexExports(templates)
  const rules = allIngressRules(templates)

  const target = 'reconcile-staging-control-db'
  const found = []

  for (const entry of rules) {
    const targetRef = resolveGroupRef(entry.target, exportsByName)
    const targetGroup = groups.get(targetRef.value)
    if (targetGroup === undefined || targetGroup.groupName !== target) continue

    const sourceRef = entry.rule.SourceSecurityGroupId
    assert.notEqual(
      sourceRef,
      undefined,
      `${target} carries an ingress rule with no SourceSecurityGroupId ` +
        `(${JSON.stringify(entry.rule)}). A database group must name a group, never a range.`,
    )
    const source = resolveGroupRef(sourceRef, exportsByName)
    assert.notEqual(
      source.kind,
      'unresolved',
      `${target} names a source this test cannot read (${JSON.stringify(sourceRef)}). ` +
        'Extend resolveGroupRef; do not let it skip.',
    )
    const sourceGroup = groups.get(source.value)
    assert.notEqual(
      sourceGroup,
      undefined,
      `${target} admits ${source.value}, which is not a security group this app declares. ` +
        'A group from outside the app reaching the control database is exactly what this ' +
        'assertion exists to find.',
    )
    found.push(sourceGroup.groupName)
  }

  /* Sorted, so the failure message is stable and a reordering is not a diff. */
  const actual = [...found].sort()
  const expected = [...CONTROL_DATABASE_SOURCES].sort()

  assert.ok(
    actual.length > 0,
    `${target} has no ingress rule at all; this assertion would pass vacuously`,
  )
  assert.deepEqual(
    actual,
    expected,
    `${target} admits [${actual.join(', ')}] and the argued set is [${expected.join(', ')}]. ` +
      'Every source here is a path into the control database: the control plane`s own tasks, ' +
      'the rotation function that ALTERs its roles, and - since G1161/G1284 - the DATA plane, ' +
      'read-only as reconcile_control_reader. A FOURTH source is a new cross-boundary path ' +
      'and must be argued in infra/lib/network-stack.ts and added here, in that order.',
  )
}

function templatesFrom(fixture) {
  const run = runInfraScript(fixture)
  assert.equal(run.status, 0, `${fixture} exited ${run.status}: ${run.stderr || run.stdout}`)
  return JSON.parse(run.stdout)
}

// ---------------------------------------- 1. the pair: green, then two reds

test('test_the_real_app_carries_no_rule_that_crosses_the_plane_boundary', () => {
  assertPlaneBoundaryHolds(synthesisedTemplates())
})

test('test_admitting_the_control_plane_group_to_the_data_database_group_is_caught', () => {
  /* The red witness. Without it, an assertion that never fires and an
   * assertion that holds are the same green. */
  assert.throws(
    () => assertPlaneBoundaryHolds(templatesFrom('test-fixtures/cross-plane-sg.ts')),
    /INVARIANT 3/,
    'the cross-plane fixture adds exactly the rule G253 forbids and the assertion did not catch it',
  )
})

test('test_admitting_the_whole_vpc_cidr_to_the_data_database_group_is_caught', () => {
  assert.throws(
    () => assertPlaneBoundaryHolds(templatesFrom('test-fixtures/cidr-ingress-sg.ts')),
    /admits a CIDR range/,
    'the CIDR fixture opens the database group to the whole VPC and the assertion did not catch it',
  )
})

// ------------------- 1a. the one permitted cross-plane edge — G1161, G1284

/**
 * The POSITIVE half. `assertPlaneBoundaryHolds()` passing proves the edge is
 * TOLERATED; it does not prove the edge is THERE, and an assertion that would
 * be equally green if G1161's rule had never been written is not evidence about
 * G1161. This names the rule.
 */
test('test_the_data_plane_task_group_reaches_the_control_alb_and_never_the_control_database', () => {
  const templates = synthesisedTemplates()
  const groups = indexSecurityGroups(templates)
  const exportsByName = indexExports(templates)
  const rules = allIngressRules(templates)

  const reached = []
  for (const entry of rules) {
    const sourceRef = entry.rule.SourceSecurityGroupId
    if (sourceRef === undefined) continue
    const source = resolveGroupRef(sourceRef, exportsByName)
    const sourceGroup = groups.get(source.value)
    if (sourceGroup?.groupName !== 'reconcile-staging-data-tasks') continue
    const target = resolveGroupRef(entry.target, exportsByName)
    const targetGroup = groups.get(target.value)
    if (targetGroup === undefined) continue
    reached.push({ target: targetGroup.groupName, port: entry.rule.FromPort })
  }

  /* ⛔ G4320, 5 Oct 2026 — THE OWNER'S "Full restore" RULING RETIRED G1161's
     edge. The data-plane task group reaches the control database on NO rule:
     the data plane holds no credential for it and reaches the roster over the
     control plane's signed internal tier instead. */
  const control = reached.filter((r) => r.target === 'reconcile-staging-control-db')
  assert.deepEqual(
    control,
    [],
    'G4320: the data-plane task group reaches the control database again. The owner retired ' +
      'both control-DB credentials from the data plane on 5 Oct 2026; an ingress rule with no ' +
      `credential behind it is a path waiting for one. Found: ${JSON.stringify(control)}`,
  )

  /* And nothing wider came with it. The data-plane tasks group reaching some
   * THIRD control-plane group - the ALB, the rotation function - would pass
   * every other assertion in this file the moment the pair above is permitted. */
  /* G4310 — and exactly one rule to the control ALB, on the control plane's
   * port, which is the internal edge the owner ruled on 5 Oct 2026. */
  const alb = reached.filter((r) => r.target === 'reconcile-staging-control-alb')
  assert.deepEqual(
    alb.map((r) => r.port),
    [9070],
    'G4310: the data-plane task group must reach the control ALB on exactly one rule, on the ' +
      `control plane port 9070. Found: ${JSON.stringify(alb)}`,
  )

  const otherControlTargets = reached
    .map((r) => r.target)
    .filter(
      (t) =>
        t.startsWith('reconcile-staging-control-') &&
        t !== 'reconcile-staging-control-db' &&
        t !== 'reconcile-staging-control-alb',
    )
  assert.deepEqual(
    otherControlTargets,
    [],
    `the data-plane task group also reaches [${otherControlTargets.join(', ')}] in the control ` +
      'plane. G1161 opened ONE edge, to the control DATABASE, for a read-only pool, and G4310 ' +
      'one more, to the control ALB, for the signed internal tier. Nothing else.',
  )
})

// ------------- 1b. the control database's source set: green, then one red

test('test_the_control_database_admits_exactly_its_two_argued_sources', () => {
  assertControlDatabaseSourcesAreExactlyTheArguedSet(synthesisedTemplates())
})

test('test_a_fourth_source_on_the_control_database_is_caught_even_when_it_is_same_plane', () => {
  /**
   * 🛑 THE RED WITNESS, AND THE FIXTURE IS SAME-PLANE ON PURPOSE. It admits
   * `reconcile-staging-control-alb` — `Plane=control` — to
   * `reconcile-staging-control-db`, so every OTHER assertion in this file
   * passes it: the planes match, the port is 5432, the protocol is tcp, the
   * target is not the tenant database. **If this assertion did not exist, that
   * rule would be green**, which is what makes this test the one that carries
   * G1284 rather than a restatement of the boundary check.
   */
  assert.throws(
    () =>
      assertControlDatabaseSourcesAreExactlyTheArguedSet(
        templatesFrom('test-fixtures/control-db-fourth-source.ts'),
      ),
    /and the argued set is/,
    'the fourth-source fixture adds a same-plane path into the control database and the ' +
      'assertion did not catch it',
  )
})

test('test_the_fourth_source_fixture_passes_every_other_assertion_in_this_file', () => {
  /**
   * The control for the control. This is what proves the previous test is
   * load-bearing rather than duplicating `assertPlaneBoundaryHolds()`: the same
   * fixture that the source-set assertion REJECTS is one the boundary assertion
   * ACCEPTS. If this ever starts throwing, the two assertions have converged and
   * one of them has stopped earning its place.
   */
  assertPlaneBoundaryHolds(templatesFrom('test-fixtures/control-db-fourth-source.ts'))
})

// ------------------------------------------- 2. the shape of the two pairs

/**
 * ⚠️ THIS TEST WAS NAMED `..._and_only_from_its_own_plane` UNTIL 20 Sep 2026
 * AND ITS BODY NEVER CHECKED A PLANE — it checks the PROTOCOL and the PORT, and
 * nothing else. The name is corrected rather than the body extended, because
 * the plane question is `assertPlaneBoundaryHolds()`'s arms 3 and 4 and a
 * second copy here would be the drift this file warns about at its head. The
 * old name mattered: it is why a reader could believe the source set was
 * already asserted when it was not, which is the gap G1284 closes below.
 */
test('test_each_database_group_admits_only_tcp_5432_and_no_port_range', () => {
  const templates = synthesisedTemplates()
  const groups = indexSecurityGroups(templates)
  const exportsByName = indexExports(templates)
  const rules = allIngressRules(templates)

  const seen = new Map(DATABASE_GROUP_NAMES.map((name) => [name, []]))

  for (const entry of rules) {
    const target = resolveGroupRef(entry.target, exportsByName)
    const targetGroup = groups.get(target.value)
    if (targetGroup === undefined || !seen.has(targetGroup.groupName)) continue
    seen.get(targetGroup.groupName).push(entry.rule)
  }

  for (const [name, found] of seen) {
    assert.ok(found.length > 0, `${name} has no ingress rule at all; nothing could reach it`)
    for (const rule of found) {
      assert.equal(rule.IpProtocol, 'tcp', `${name} admits a non-tcp protocol`)
      assert.equal(rule.FromPort, 5432, `${name} admits port ${rule.FromPort}, not 5432`)
      assert.equal(rule.ToPort, 5432, `${name} admits a port RANGE ending at ${rule.ToPort}`)
    }
  }
})

test('test_the_four_plane_security_groups_exist_and_each_names_its_own_plane', () => {
  const groups = [...indexSecurityGroups(synthesisedTemplates()).values()]
  const byName = new Map(groups.map((g) => [g.groupName, g.plane]))
  const expected = {
    'reconcile-staging-data-tasks': 'data',
    'reconcile-staging-data-db': 'data',
    'reconcile-staging-data-rotation': 'data',
    'reconcile-staging-control-tasks': 'control',
    'reconcile-staging-control-db': 'control',
    'reconcile-staging-control-rotation': 'control',
  }
  for (const [name, plane] of Object.entries(expected)) {
    assert.equal(byName.get(name), plane, `${name} should carry Plane=${plane}`)
  }
})

test('test_no_security_group_in_the_app_is_tagged_shared', () => {
  /* `shared` is honest for a VPC and dishonest for a security group: a group
   * belongs to exactly one plane, and one tagged `shared` would be invisible to
   * the tag query G260 describes while looking tagged. */
  for (const group of indexSecurityGroups(synthesisedTemplates()).values()) {
    assert.notEqual(
      group.plane,
      'shared',
      `${group.groupName} is tagged Plane=shared; a security group serves one plane`,
    )
  }
})

// --------------------------------------------------- 3. the cost decisions

test('test_there_is_exactly_one_nat_gateway_and_it_is_not_one_per_az', () => {
  const templates = synthesisedTemplates()
  const nats = Object.values(templates).flatMap((t) => resourcesOfType(t, 'AWS::EC2::NatGateway'))
  assert.equal(
    nats.length,
    1,
    'CDK defaults to one NAT gateway PER AZ, at roughly $33/month each. Two AZs and ' +
      `two gateways is the default nobody chose; found ${nats.length}.`,
  )
})

test('test_the_vpc_spans_two_availability_zones_with_a_public_and_a_private_subnet_in_each', () => {
  const templates = synthesisedTemplates()
  const subnets = Object.values(templates).flatMap((t) => resourcesOfType(t, 'AWS::EC2::Subnet'))
  assert.equal(subnets.length, 4, 'two AZs x (one public + one private) is four subnets')
  const zones = new Set(subnets.map(([, s]) => s.Properties?.AvailabilityZone))
  assert.equal(zones.size, 2, `expected two distinct AZs, got ${[...zones].join(', ')}`)
  for (const zone of zones) {
    assert.match(zone, /^us-west-2[ab]$/, 'G256/G279 put this product in us-west-2')
  }
})

test('test_the_database_groups_open_no_egress_because_a_database_initiates_nothing', () => {
  const templates = synthesisedTemplates()
  for (const template of Object.values(templates)) {
    for (const [, resource] of resourcesOfType(template, SECURITY_GROUP)) {
      if (!DATABASE_GROUP_NAMES.includes(resource.Properties?.GroupName)) continue
      const egress = resource.Properties?.SecurityGroupEgress ?? []
      for (const rule of egress) {
        /* CDK expresses "no egress" as one deliberately unroutable rule,
         * because CloudFormation reads an EMPTY egress list as allow-all. That
         * artefact is what an empty list looks like; anything else is a real
         * outbound grant. */
        assert.equal(
          rule.CidrIp,
          '255.255.255.255/32',
          `${resource.Properties.GroupName} has a real egress rule (${JSON.stringify(rule)}). ` +
            'An Aurora cluster initiates nothing.',
        )
      }
    }
  }
})

// --------------- G4310. the control ALB admits the data-plane tasks and nothing else

test('test_the_control_alb_admits_exactly_the_data_plane_task_group_on_the_control_port', () => {
  const templates = synthesisedTemplates()
  const groups = indexSecurityGroups(templates)
  const exportsByName = indexExports(templates)
  const found = []
  for (const entry of allIngressRules(templates)) {
    const target = groups.get(resolveGroupRef(entry.target, exportsByName).value)
    if (target?.groupName !== 'reconcile-staging-control-alb') continue
    const sourceRef = entry.rule.SourceSecurityGroupId
    const source =
      sourceRef === undefined ? undefined : groups.get(resolveGroupRef(sourceRef, exportsByName).value)
    const label = source?.groupName ?? JSON.stringify(entry.rule.CidrIp ?? entry.rule.SourcePrefixListId ?? '?')
    found.push(`${label}:${entry.rule.FromPort}-${entry.rule.ToPort}`)
  }
  assert.deepEqual(
    found,
    ['reconcile-staging-data-tasks:9070-9070'],
    'G4310: the control plane ALB is the internal edge the owner ruled on 5 Oct 2026 — the ' +
      'data-plane task group, on the control port, and NO other source: no CIDR, no prefix list, ' +
      `no CloudFront origin. Found: [${found.join(', ')}]`,
  )
})
