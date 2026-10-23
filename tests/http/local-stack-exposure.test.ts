/**
 * WHAT THE DOCUMENTED RUNBOOK ACTUALLY EXPOSES — the second half of ruling 3,
 * and the half `tests/http/plane-separation.test.ts` cannot see.
 *
 * 🛑 WHY A SECOND TOPOLOGY FILE EXISTS. `plane-separation.test.ts` asks whether
 * the control plane can reach the DATA plane. This one asks whether a stranger
 * can reach EITHER. They are different questions and the second one has a
 * different answer: an adversarial read on 16 Aug 2026 found that
 * `docker compose up --build` published both planes on every host interface with
 * `RECONCILE_LOCAL_TEST_AUTH=1` set on both, so anyone who could route a packet
 * to the host could mint a token — the signing key is a constant in a public
 * repository — and read any tenant's rows. The image refused; the runbook did
 * not. Nothing in the suite noticed, because every existing assertion was about
 * the CODE and the defect was in the FILE THAT STARTS IT.
 *
 * ⚠️ THIS FILE NEVER SKIPS. Like `plane-separation.test.ts`, it reads artefacts
 * rather than running anything, so it is one of the two checks that still run on
 * a machine with no PostgreSQL and no container runtime — which is exactly the
 * machine on which somebody edits a compose file.
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ A  Every port compose PUBLISHES is bound to 127.0.0.1. A stack that turns   │
 * │    authentication into a flag and then binds 0.0.0.0 has published its own  │
 * │    front door; Docker's iptables rules bypass most host firewalls, so       │
 * │    "it is only local" has to be written down rather than assumed.           │
 * │ B  The services that SERVE REQUESTS carry no provisioning credential. The   │
 * │    superuser and the `BYPASSRLS` migrator belong to a one-shot job that     │
 * │    EXITS; a long-running process that holds them voids the fence its own    │
 * │    pool is built on the moment anything can read `process.env`.             │
 * │ C  The serving entry point cannot even REACH the provisioning code. B is an │
 * │    inventory and inventories drift; C is the module graph, and it is the    │
 * │    one that survives somebody adding an environment variable back.          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ A LINE SCANNER, NOT A YAML PARSER — the same posture, and the same debt,
 * as `plane-separation.test.ts` and `tools/check-wire-mirror.mjs`. G109's real
 * parser is ruled and unbought. Every scan below therefore proves it found its
 * anchor before it concludes anything from a silence.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { REPO_ROOT } from './harness.ts'

const COMPOSE_PATH = path.join(REPO_ROOT, 'compose.yaml')

/* ------------------------------------------------------------------ *
 * The compose file, sliced by service.
 * ------------------------------------------------------------------ */

interface Service {
  readonly name: string
  readonly lines: readonly string[]
}

function services(text: string): readonly Service[] {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => /^services:\s*$/.test(l))
  if (at === -1) return []
  const out: Service[] = []
  let current: { name: string; lines: string[] } | null = null
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '' || /^\s*#/.test(line)) continue
    const indent = line.length - line.trimStart().length
    if (indent === 0) break
    const head = /^\s{2}([A-Za-z0-9_.-]+):\s*$/.exec(line)
    if (indent === 2 && head !== null) {
      if (current !== null) out.push({ name: current.name, lines: current.lines })
      current = { name: head[1] ?? '', lines: [] }
      continue
    }
    if (current !== null) current.lines.push(line)
  }
  if (current !== null) out.push({ name: current.name, lines: current.lines })
  return out
}

/** The `- "HOST:CONTAINER"` entries under a service's `ports:` key. */
function publishedPorts(service: Service): readonly string[] {
  const out: string[] = []
  let inside = false
  let portsIndent = 0
  for (const line of service.lines) {
    const indent = line.length - line.trimStart().length
    if (/^\s*ports:\s*$/.test(line)) {
      inside = true
      portsIndent = indent
      continue
    }
    if (!inside) continue
    if (indent <= portsIndent) break
    const entry = /^\s*-\s*["']?([^"'\s]+)["']?\s*$/.exec(line)
    if (entry !== null) out.push(entry[1] ?? '')
  }
  return out
}

/** `KEY: value` under a service's `environment:` mapping. */
function environment(service: Service): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  let inside = false
  let envIndent = 0
  for (const line of service.lines) {
    const indent = line.length - line.trimStart().length
    if (/^\s*environment:\s*$/.test(line)) {
      inside = true
      envIndent = indent
      continue
    }
    if (!inside) continue
    if (indent <= envIndent) break
    const pair = /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*["']?([^"'#]*?)["']?\s*$/.exec(line)
    if (pair !== null) out.set(pair[1] ?? '', (pair[2] ?? '').trim())
  }
  return out
}

const COMPOSE_TEXT = existsSync(COMPOSE_PATH) ? readFileSync(COMPOSE_PATH, 'utf8') : null
const SERVICES = COMPOSE_TEXT === null ? [] : services(COMPOSE_TEXT)

/* ------------------------------------------------------------------ *
 * C — the static import closure of an entry point.
 * ------------------------------------------------------------------ */

const IMPORT_SPECIFIER = /(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g

/**
 * Every repository-relative module reachable from `entry` by STATIC import.
 *
 * ⚠️ STATIC ONLY, AND THAT IS THE POINT RATHER THAN A LIMITATION. A dynamic
 * `import()` inside a guarded branch is precisely the fence `server/dev/` is
 * reached through, and counting it as an edge would make that fence look like a
 * dependency. What this walker answers is the narrower question: what does the
 * loader pull in unconditionally when this file is the entry point?
 */
function importClosure(entry: string): ReadonlySet<string> {
  const seen = new Set<string>()
  const queue = [path.resolve(REPO_ROOT, entry)]
  while (queue.length > 0) {
    const file = queue.pop() as string
    const rel = path.relative(REPO_ROOT, file)
    if (seen.has(rel)) continue
    if (!existsSync(file)) continue
    seen.add(rel)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT_SPECIFIER)) {
      const spec = m[1] ?? ''
      if (!spec.startsWith('.')) continue
      queue.push(path.resolve(path.dirname(file), spec))
    }
  }
  return seen
}

/* ------------------------------------------------------------------ *
 * The credentials a SERVING process must not hold.
 * ------------------------------------------------------------------ */

/**
 * 🛑 EACH OF THESE THREE VOIDS A DIFFERENT FENCE, WHICH IS WHY THEY ARE NAMED
 * INDIVIDUALLY RATHER THAN MATCHED BY A PATTERN.
 *
 *   PGPASSWORD                   consumed IMPLICITLY by `db/provision.ts`'s
 *                                `adminClient()`, which passes no password of its
 *                                own. In compose it is the cluster SUPERUSER.
 *   RECONCILE_MIGRATOR_PASSWORD  the `LOGIN BYPASSRLS` role — the read exemption
 *                                every isolation assertion in this directory is
 *                                relative to.
 *   RECONCILE_DB_ADMIN           names the superuser role. Harmless alone and
 *                                listed anyway: it is half of a credential, and
 *                                the half that tells an attacker what to ask for.
 */
const PROVISIONING_ENV = ['PGPASSWORD', 'RECONCILE_MIGRATOR_PASSWORD', 'RECONCILE_DB_ADMIN']
const CONTROL_PROVISIONING_ENV = [
  'RECONCILE_CONTROL_DB_ADMIN',
  'RECONCILE_CONTROL_DB_ADMIN_PASSWORD',
]

describe('the local stack publishes nothing beyond loopback, and serves with no provisioning key', () => {
  /* ================================================================ *
   * A. EVERY PUBLISHED PORT IS BOUND TO LOOPBACK.
   * ================================================================ */

  it('every port compose publishes is bound to 127.0.0.1', () => {
    if (COMPOSE_TEXT === null) {
      assert.fail(
        'there is no compose.yaml at the repository root, so the documented runbook ' +
          'has no exposure to check. See tests/http/plane-separation.test.ts for what ' +
          'ruling 3 asks the topology to carry.',
      )
    }

    /* ANTI-VACUOUS. A scanner that found no `ports:` at all would report perfect
     * containment on a file that published everything. Prove it can see one. */
    const publishing = SERVICES.filter((s) => publishedPorts(s).length > 0)
    assert.ok(
      publishing.length >= 2,
      `only ${publishing.length} service(s) with a \`ports:\` list were found in ` +
        'compose.yaml. Both planes publish one, so this scanner is reading the file ' +
        'wrongly and the assertion below would pass against a stack that published ' +
        'every port it has.',
    )

    const exposed = publishing.flatMap((s) =>
      publishedPorts(s)
        .filter((p) => !p.startsWith('127.0.0.1:') && !p.startsWith('localhost:'))
        .map((p) => `${s.name}: ${p}`),
    )

    assert.deepEqual(
      exposed,
      [],
      'compose PUBLISHES a port on every host interface. A published port with no ' +
        'host prefix binds 0.0.0.0 — and Docker installs its own iptables rules ' +
        'ahead of most host firewalls, so this is reachable from the network the ' +
        'machine is on rather than from the machine. This stack sets ' +
        'RECONCILE_LOCAL_TEST_AUTH=1 and signs tokens with a key that is a constant ' +
        'in a public repository, so a reachable port is an unauthenticated read of ' +
        'any tenant. Prefix the host binding: "127.0.0.1:9080:9080".',
    )
  })

  it('a service that sets the local-test-auth flag publishes only loopback ports', () => {
    /* ANTI-VACUOUS: the flag must be findable, or "no service sets it" and "the
     * scanner cannot read an environment mapping" are the same silence. */
    const flagged = SERVICES.filter((s) => environment(s).get('RECONCILE_LOCAL_TEST_AUTH') === '1')
    assert.ok(
      flagged.length > 0,
      'no service in compose.yaml sets RECONCILE_LOCAL_TEST_AUTH=1, so either the ' +
        'local stack cannot authenticate anybody — in which case the runbook does not ' +
        'work — or this scanner cannot read an `environment:` mapping, in which case ' +
        'the assertion below is the silence of a broken check.',
    )

    for (const service of flagged) {
      const bad = publishedPorts(service).filter((p) => !p.startsWith('127.0.0.1:'))
      assert.deepEqual(
        bad,
        [],
        `the \`${service.name}\` service accepts locally minted test tokens AND ` +
          'publishes a port beyond loopback. Ruling 2 makes the FLAG the boundary and ' +
          'says so plainly — "a key that looks secret invites someone to treat \'we ' +
          'rotated it\' as a control". A flag that admits the holder of a published ' +
          'key is only a boundary while the holder has to be on this machine.',
      )
    }
  })

  /* ================================================================ *
   * B. THE SERVING SERVICES CARRY NO PROVISIONING CREDENTIAL.
   * ================================================================ */

  it('the serving services hold neither the superuser nor the BYPASSRLS migrator', () => {
    const byName = new Map(SERVICES.map((s) => [s.name, s]))

    const migrate = byName.get('data-plane-migrate')
    if (migrate === undefined) {
      assert.fail(
        'compose.yaml declares no `data-plane-migrate` service. Provisioning needs a ' +
          'superuser (CREATE ROLE … BYPASSRLS requires one) and migrating needs the ' +
          'BYPASSRLS role itself; a long-running server that holds both keeps, for its ' +
          'whole life, the two credentials that void the fence its own pool is built ' +
          'on. The job that needs them must be a job that EXITS.',
      )
    }

    /* ANTI-VACUOUS, AND IT IS THE ASSERTION THE NEXT ONE RESTS ON. Before
     * claiming the serving block carries no provisioning variable, prove this
     * scanner can see one — by finding it where it is REQUIRED to be. */
    const migrateEnv = environment(migrate)
    const held = PROVISIONING_ENV.filter((k) => (migrateEnv.get(k) ?? '') !== '')
    assert.ok(
      held.length > 0,
      'the `data-plane-migrate` service carries none of ' +
        `[${PROVISIONING_ENV.join(', ')}], so either it cannot provision anything — in ` +
        'which case the stack does not come up — or this scanner cannot read an ' +
        'environment mapping, and the assertions below assert nothing.',
    )

    for (const [service, forbidden] of [
      ['data-plane', PROVISIONING_ENV],
      ['control-plane', CONTROL_PROVISIONING_ENV],
    ] as ReadonlyArray<readonly [string, readonly string[]]>) {
      const found = byName.get(service)
      if (found === undefined) assert.fail(`compose.yaml declares no \`${service}\` service`)
      const env = environment(found)
      const carried = forbidden.filter((k) => env.has(k))
      assert.deepEqual(
        carried,
        [],
        `the long-running \`${service}\` service carries [${carried.join(', ')}]. ` +
          '`db/provision.ts` says in its own header that "handing a superuser ' +
          'connection string to application code is the shape of problem ' +
          'docs/infrastructure-risk-register.md exists to track" — and a serving ' +
          'process is application code. Any disclosure of `process.env` in it yields ' +
          'BYPASSRLS, and then superuser, whatever the request pool connects as.',
      )
    }
  })

  it('a one-shot provisioning job publishes no port at all', () => {
    for (const name of ['data-plane-migrate', 'control-plane-migrate']) {
      const service = SERVICES.find((s) => s.name === name)
      if (service === undefined) assert.fail(`compose.yaml declares no \`${name}\` service`)
      assert.deepEqual(
        publishedPorts(service),
        [],
        `the \`${name}\` job publishes a port. It holds the credentials the serving ` +
          'services must not, so it is the one container in this stack that must be ' +
          'reachable from nothing at all.',
      )
    }
  })

  /* ================================================================ *
   * C. THE SERVING ENTRY POINT CANNOT REACH THE PROVISIONING CODE.
   *
   * B is an inventory. An inventory is a list somebody adds a line back to.
   * This is the module graph: `server/data-plane/main.ts` does not import the
   * module that can create a role or run a migration, so the serving process has
   * no code path to superuser even if a variable reappeared.
   * ================================================================ */

  it('the serving entry point does not import the provisioning modules — and the migrate job does', () => {
    const serving = importClosure('server/data-plane/main.ts')

    /* ANTI-VACUOUS: the walker must actually walk. A closure of one file would
     * satisfy every exclusion below. */
    assert.ok(
      serving.size >= 5,
      `the import walker reached only ${serving.size} module(s) from ` +
        'server/data-plane/main.ts, so it is not resolving relative specifiers and ' +
        'the exclusions below are the silence of a broken check. Reached: ' +
        `${[...serving].join(', ')}`,
    )
    assert.ok(
      serving.has('db/tenant-scope.ts'),
      'the serving entry point does not reach `db/tenant-scope.ts`, which is where ' +
        "`withTenantScope()` and the request pool live. Either the walker is wrong or " +
        'the plane no longer serves anything.',
    )

    for (const forbidden of ['db/provision.ts', 'db/migrate.ts']) {
      assert.ok(
        !serving.has(forbidden),
        `\`server/data-plane/main.ts\` statically imports \`${forbidden}\`, so the ` +
          'serving process carries the code that creates roles and runs DDL. The ' +
          'credentials are only half of this control: the other half is that the ' +
          'process which serves a request cannot call `createRoles()` because it never ' +
          'loaded it. Provisioning belongs to the one-shot job.',
      )
    }

    /* The other half of the same claim: the job that SHOULD hold them, does —
     * otherwise "the serving entry point does not import provisioning" would be
     * satisfied by a repository with no provisioning at all. */
    const job = importClosure('server/data-plane/migrate-main.ts')
    for (const required of ['db/provision.ts', 'db/migrate.ts']) {
      assert.ok(
        job.has(required),
        `\`server/data-plane/migrate-main.ts\` does not reach \`${required}\`, so ` +
          'nothing in this stack provisions the database and the exclusion asserted ' +
          'above is vacuous.',
      )
    }
  })
})
