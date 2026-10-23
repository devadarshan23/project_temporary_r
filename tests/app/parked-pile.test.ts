/**
 * C9 · THE PARKED PILE ON THE REGISTER — rows 18 and 19, feat/ui-parked-pile
 * (G3501–G3510, 3 Oct 2026). The pure half, under `node --test`, with no
 * renderer: the client's reading of the three operations, the words, and the
 * raise probe's reading of the gate. The browser half — a real plane, a real
 * Chromium, a clerk who follows the line and an administrator who raises — is
 * `tests/e2e/parked-pile.test.ts`.
 *
 *   §1  the client's enum IS the contract's, derived from the YAML both ways
 *   §2  G106 — the sample is copied BY NAME; a value beside the keys does not
 *       survive the reader. ⚠️ WITNESSED RED: with `asParkedPane()` spreading
 *       `body['sample']` instead of copying two properties, §2a failed with
 *       `Expected values to be strictly deep-equal` — a `values` property
 *       carrying the held value rode through into the component's state.
 *   §3  the reader REFUSES rather than repairs — an unknown reason, an absent
 *       escalation, an absent filename, an absent count
 *   §4  the raise is drawn on the SESSION'S published capabilities, not on a
 *       probe (G3781). ⚠️ THIS WAS *"the raise probe — 400 is the gate's yes,
 *       403 its no"* (G3504/G3505) UNTIL 4 Oct 2026: `mayRaiseParked()` POSTed
 *       an empty body per opened pane. `getSessionPrincipal.capabilities`
 *       (G3521, the owner's G3664) answers the same question, so the probe and
 *       its pure reader are DELETED and §4 asserts their absence, the gate the
 *       raise is drawn on, and that the 403 backstop survives.
 *       ⚠️ WITNESSED RED: the probe re-exported → §4a; `DRAW_GATES.raiseParked`
 *       set to `view_exception` → §4b against the contract's `x-capability`.
 *   §8  both places (row 18, G3782): Setup draws the SAME component, reading
 *       the same operation, and offers the pairing only through its own form.
 *   §9  `pairSeedOf()` — the seed follows `nameFallsUnder()`'s two rules.
 *       ⚠️ WITNESSED RED: seeding a `filename` with the whole name (folder
 *       included) failed §9a and §9d — `checkSourcePair()` refuses a `/`.
 *   §5  the words are total and say what the plane says, nothing more
 *   §6  the pile is APART from the register, and the pack's "Parked" facet is
 *       NOT this pile — both read off source, not asserted in prose
 *   §7  invariant 6 in the component's own source
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

import {
  PARKED_BECAUSE,
  asParkedLine,
  asParkedPane,
  asParkedPile,
} from '../../frontend/src/api/parked.ts'
import * as parkedApi from '../../frontend/src/api/parked.ts'
import { DRAW_GATES } from '../../frontend/src/capabilities.ts'
import { nameFallsUnder, arrivalFilenameFrom } from '../../model/ingestion.ts'
import {
  NO_FILENAME,
  pairSeedOf,
  PARKED_BECAUSE_SHORT,
  PARKED_BECAUSE_WORD,
  pileIsDrawn,
  pileSummary,
  unblockerOf,
} from '../../frontend/src/parked.ts'
import { REPO } from '../design/render.ts'

const CONTRACT = parse(readFileSync(join(REPO, 'docs', 'contracts', 'capability.openapi.yaml'), 'utf8')) as {
  components: { schemas: Record<string, { properties: Record<string, { enum?: string[] }> }> }
}

const HELD_VALUE = 'held-value-never-on-a-screen'

function line(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    arrivalId: 'arr_a',
    endpointId: 'end_a',
    endpointLabel: 'Supplier SFTP',
    filename: 'invoices/A-1.json',
    arrivedAt: '2026-10-03T01:02:03.000Z',
    parkedBecause: 'no_declared_pair_matches',
    matchingPairIds: [],
    escalation: null,
    unblockedBy: { capability: 'configure_endpoint' },
    ...over,
  }
}

describe('§1 · the client’s reasons ARE the contract’s', () => {
  it('ParkedArrival and ParkedArrivalPane name exactly PARKED_BECAUSE, in order', () => {
    for (const schema of ['ParkedArrival', 'ParkedArrivalPane']) {
      const declared = CONTRACT.components.schemas[schema]?.properties['parkedBecause']?.enum
      assert.deepEqual(declared, [...PARKED_BECAUSE], `${schema}.parkedBecause drifted from api/parked.ts`)
    }
  })
})

describe('§2 · G106 — the sample’s KEYS and never a value', () => {
  it('§2a · a value published beside the keys does not survive the reader', () => {
    const pane = asParkedPane({
      ...line(),
      sample: { isRecord: true, fields: ['InvNo', 'Payer'], values: { Payer: HELD_VALUE } },
      held: { Payer: HELD_VALUE },
    })
    assert.deepEqual(pane.sample, { isRecord: true, fields: ['InvNo', 'Payer'] })
    assert.equal(JSON.stringify(pane).includes(HELD_VALUE), false, 'a VALUE of a held artefact survived the reader')
  })

  it('§2b · and the line is copied by name too', () => {
    const read = asParkedLine({ ...line(), payload: { x: HELD_VALUE } }, 'listParkedArrivals')
    assert.equal(JSON.stringify(read).includes(HELD_VALUE), false)
  })

  it('§2c · a filename is carried verbatim — markup-shaped text stays text', () => {
    const name = 'misc/readme <b>.txt'
    assert.equal(asParkedLine(line({ filename: name }), 'op').filename, name)
  })
})

describe('§3 · the reader refuses; it never repairs', () => {
  it('an unknown reason is refused rather than drawn', () => {
    assert.throws(() => asParkedLine(line({ parkedBecause: 'mysterious' }), 'op'), /cannot name/)
  })
  it('an absent escalation is refused rather than defaulted to "not raised"', () => {
    const { escalation: _drop, ...rest } = line()
    void _drop
    assert.throws(() => asParkedLine(rest, 'op'), /escalation/)
  })
  it('an absent filename is refused; a null one is read', () => {
    const { filename: _drop, ...rest } = line()
    void _drop
    assert.throws(() => asParkedLine(rest, 'op'), /filename/)
    assert.equal(asParkedLine(line({ filename: null }), 'op').filename, null)
  })
  it('an absent count is refused rather than defaulted to 0', () => {
    assert.throws(() => asParkedPile({ items: [], drains: [] }), /awaitingSetup/)
  })
  it('a pane with no sample is refused', () => {
    assert.throws(() => asParkedPane(line()), /sample/)
  })
})

const OPS = parse(readFileSync(join(REPO, 'docs', 'contracts', 'capability.openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string; 'x-capability'?: string }>>
}
function capabilityOf(operationId: string): string | undefined {
  for (const methods of Object.values(OPS.paths)) {
    for (const op of Object.values(methods)) {
      if (typeof op === 'object' && op !== null && op.operationId === operationId) return op['x-capability']
    }
  }
  return undefined
}

describe('§4 · the raise is drawn on the session’s capabilities — the probe is gone (G3781)', () => {
  it('§4a · no probe is exported, and nothing POSTs an empty body to the escalation', () => {
    const exported = Object.keys(parkedApi)
    assert.equal(exported.includes('mayRaiseParked'), false, 'mayRaiseParked is exported again — the probe is back')
    assert.equal(exported.includes('raiseProbeAnswer'), false, 'raiseProbeAnswer is exported again')
    assert.equal(/body:\s*\{\s*\}/.test(code('api/parked.ts')), false, 'an empty-body POST is back in the reader')
    assert.equal(/mayRaise/.test(code('components/ParkedPile.tsx')), false)
  })

  it('§4b · both acts the pile draws are gated on the verb the CONTRACT names for them', () => {
    const raise = capabilityOf('raiseParkedArrival')
    const pair = capabilityOf('declareEndpointDocumentType')
    assert.equal(typeof raise, 'string', 'raiseParkedArrival not found in the contract — the derivation is inert')
    assert.equal(typeof pair, 'string', 'declareEndpointDocumentType not found in the contract — the derivation is inert')
    assert.equal(DRAW_GATES.raiseParked, raise)
    assert.equal(DRAW_GATES.declarePairing, pair)
  })

  it('§4c · the component reads the gate, and the 403 backstop still removes the raise', () => {
    const src = code('components/ParkedPile.tsx')
    assert.match(src, /useHolds\(DRAW_GATES\.raiseParked\)/)
    assert.match(src, /useHolds\(DRAW_GATES\.declarePairing\)/)
    assert.match(src, /err\.status === 403\)\s*\{\s*setRefused\(true\)/, 'the 403 backstop is gone')
  })
})

describe('§5 · the words', () => {
  it('every reason has a sentence and a short form', () => {
    for (const k of PARKED_BECAUSE) {
      assert.ok(PARKED_BECAUSE_WORD[k].length > 0)
      assert.ok(PARKED_BECAUSE_SHORT[k].length > 0)
      assert.equal(/[_]/.test(PARKED_BECAUSE_WORD[k]), false, `${k}: a raw token on a screen`)
    }
  })
  it('the summary counts the pile and the raised ones, and nothing else', () => {
    assert.equal(pileSummary({ awaitingSetup: { parked: 3, raisedWithFde: 0 } }), '3 deliveries parked, awaiting setup')
    assert.equal(
      pileSummary({ awaitingSetup: { parked: 1, raisedWithFde: 1 } }),
      '1 delivery parked, awaiting setup · 1 raised with the 1CloudHub FDE',
    )
  })
  it('an empty pile with no drain is not drawn; a drain alone is', () => {
    const empty = { awaitingSetup: { parked: 0, raisedWithFde: 0 }, items: [], drains: [] }
    assert.equal(pileIsDrawn(empty), false)
    assert.equal(
      pileIsDrawn({
        ...empty,
        drains: [{ pairId: 'p', endpointId: 'e', documentTypeId: 'd', drained: 2, lastDrainedAt: '2026-10-03T00:00:00Z' }],
      }),
      true,
    )
  })
  it('who unblocks it is a ROLE, never a guessed person', () => {
    assert.match(unblockerOf('configure_endpoint'), /sets up sources/)
    assert.equal(/sets up sources/.test(unblockerOf('something_else')), false)
    assert.ok(NO_FILENAME.length > 0)
  })
})

const SRC = join(REPO, 'frontend', 'src')
const code = (rel: string): string =>
  readFileSync(join(SRC, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

describe('§6 · APART from the register — and not the pack’s "Parked" facet', () => {
  it('the pile is drawn beside the register and passes it nothing', () => {
    const main = code('main.tsx')
    assert.match(main, /<ParkedPile origin=\{plane\.origin\} \/>\s*<ExceptionRegister/)
    assert.equal(/fetchParked|ParkedPile[^.]*counts/.test(main.replace(/<ParkedPile[^>]*\/>/, '')), false)
  })

  it('the pack’s "Parked" facet selects a LINE of kind parked — a floor-parked line, not a delivery', () => {
    const pack = readFileSync(join(REPO, 'docs', 'handoff-pack', 'C1 Close.dc.html'), 'utf8')
    assert.match(pack, /\{k:'park',\s*label:'Parked',\s*test:r=>r\.kind === 'parked'\}/)
    assert.match(pack, /kind:'parked'[\s\S]{0,400}fell below the floor and were parked/)
  })
})

describe('§7 · invariant 6 in the component', () => {
  it('no field reaches markup, an href or a style', () => {
    const src = code('components/ParkedPile.tsx')
    assert.equal(src.includes('dangerouslySetInnerHTML'), false)
    assert.equal(/href=/.test(src), false)
    assert.equal(/style=\{/.test(src), false)
  })
})

describe('§8 · both places (row 18, G3782) — Setup draws the SAME pile', () => {
  it('Setup renders ParkedPile with place="setup" and never calls the reader itself', () => {
    const setup = code('components/Setup.tsx')
    assert.match(setup, /import \{ ParkedPile, type PairingRequest \} from '\.\/ParkedPile\.tsx'/)
    assert.match(setup, /<ParkedPile[\s\S]{0,200}place="setup"/)
    assert.equal(/fetchParked|api\/parked/.test(setup), false, 'Setup grew a second reader of the pile')
  })

  it('the register offers no pairing — it owns no pair form', () => {
    assert.match(code('main.tsx'), /<ParkedPile origin=\{plane\.origin\} \/>/)
  })

  it('the pairing is a pane control only where the caller offers it AND the gate is held', () => {
    const src = code('components/ParkedPile.tsx')
    assert.match(src, /onDeclarePairing !== undefined && mayPair && pane\.sample\.isRecord/)
  })
})

describe('§9 · pairSeedOf() follows the declared rule’s two comparisons', () => {
  it('§9a · a name in a folder seeds a path prefix on the folder, which claims its own delivery', () => {
    const seed = pairSeedOf('invoices/2026/A-1.json', ['InvNo', 'Payer'])
    assert.deepEqual(seed, { matchKind: 'path_prefix', matchValue: 'invoices/2026/', sourceFields: ['InvNo', 'Payer'] })
    const name = arrivalFilenameFrom('invoices/2026/A-1.json')
    assert.ok(name !== null)
    assert.equal(nameFallsUnder(name, { kind: seed.matchKind, value: seed.matchValue }), true, 'the seed does not claim its own delivery')
  })
  it('§9b · a bare name seeds an exact filename that claims it', () => {
    const seed = pairSeedOf('readme.txt', [])
    assert.deepEqual(seed, { matchKind: 'filename', matchValue: 'readme.txt', sourceFields: [] })
    const name = arrivalFilenameFrom('readme.txt')
    assert.ok(name !== null)
    assert.equal(nameFallsUnder(name, { kind: seed.matchKind, value: seed.matchValue }), true)
  })
  it('§9c · no name recorded seeds nothing to guess', () => {
    assert.deepEqual(pairSeedOf(null, ['k']), { matchKind: 'path_prefix', matchValue: '', sourceFields: ['k'] })
  })
  it('§9d · a filename seed never carries a "/" (the model refuses one in a filename pattern)', () => {
    for (const n of ['a/b.json', 'x/y/z', 'plain.csv', '/rooted.json']) {
      const seed = pairSeedOf(n, [])
      if (seed.matchKind === 'filename') assert.equal(seed.matchValue.includes('/'), false, n)
    }
  })
})
