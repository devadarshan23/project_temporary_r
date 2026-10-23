/**
 * THE NAMES THE PLANE SERVES ARE THE NAMES THE CLIENT READS — G3886, 4 Oct 2026.
 *
 * The frontend slice (#576, G3838) was written before the server could name
 * anybody and GUESSED three field names. The owner's C3-05 ruling (*"Narrow
 * name-only read …"*) is built server-side as `db/migrations/0520`, and the
 * contract now declares the fields. This suite joins the two so a rename on
 * either side is a red gate rather than a silent "a colleague" everywhere:
 *
 *   §1  every name field the client reads is declared, under that name, on the
 *       contract schema the client reads it from;
 *   §2  each surface that names a person reads the field (and draws it through
 *       `personWord()`, so a missing name is "a colleague", never an id);
 *   §3  `personWord()`'s three answers.
 *
 * WITNESSED RED: with the contract's `decidedByName` spelled `decidedByDisplayName`
 * (a mutation of the contract), §1 failed naming `ApprovalDecisionRecord`.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

import { REPO } from '../design/render.ts'
import { personWord } from '../../frontend/src/resolve-logic.ts'

const read = (p: string): string => readFileSync(join(REPO, p), 'utf8')
type Schema = { properties?: Record<string, unknown>; required?: string[] }
const schemas = (parse(read('docs/contracts/capability.openapi.yaml')) as { components: { schemas: Record<string, Schema> } })
  .components.schemas

describe('G3886 · the served names, joined to the client', () => {
  it('§1 · each name field the client reads is declared on the contract under that name', () => {
    for (const [schema, field, required] of [
      ['ExceptionQueueRow', 'assignedToName', true],
      ['Exception', 'assignedToName', true],
      ['ApprovalDecisionRecord', 'decidedByName', true],
      ['ProposalActor', 'displayName', false],
      /* G4021 — the former-member fact beside each name. */
      ['ExceptionQueueRow', 'assignedToFormerMember', true],
      ['Exception', 'assignedToFormerMember', true],
      ['ApprovalDecisionRecord', 'decidedByFormerMember', true],
      ['ProposalActor', 'formerMember', false],
    ] as const) {
      const s = schemas[schema]
      assert.ok(s?.properties?.[field] !== undefined, `${schema}.${field} is not declared on the contract`)
      assert.equal((s?.required ?? []).includes(field), required, `${schema}.${field} required-ness moved`)
    }
  })

  it('§2 · each surface reads the served field and draws it through personWord()', () => {
    const approvals = read('frontend/src/components/Approvals.tsx')
    assert.match(approvals, /proposedBy\.displayName/)
    assert.match(approvals, /decidedByName/)
    /* G4021 — the name is no longer the LAST argument: the former-member fact
       follows it. The regexes require the name argument, not its position. */
    assert.match(read('frontend/src/components/Finding.tsx'), /personWord\([^)]*assignedToName[,)]/)
    const register = read('frontend/src/components/ExceptionRegister.tsx')
    assert.match(register, /personWord\(null, null, row\.assignedToName[,)]/)
    assert.doesNotMatch(register, /\{WHOSE_SHORT\[whose\]\}/, 'a register cell draws the bare word instead of the name')
  })

  it('§3 · personWord: "you" for the viewer, the served name verbatim, "a colleague" when unnamed', () => {
    assert.equal(personWord('usr_a', 'usr_a', 'Ada'), 'you')
    assert.equal(personWord('usr_b', 'usr_a', 'Mei <b>Tan</b>'), 'Mei <b>Tan</b>')
    assert.equal(personWord('usr_b', 'usr_a', null), 'a colleague')
    assert.equal(personWord('usr_b', 'usr_a', '  '), 'a colleague')
  })

  it('§4 · G4021 — an unnamed FORMER member is "a former member", never "a colleague" and never an id', () => {
    assert.equal(personWord('usr_b', 'usr_a', null, true), 'a former member')
    assert.equal(personWord('usr_b', 'usr_a', null, false), 'a colleague')
    /* A name, when served, still wins — the plane names live co-members only,
       so the two cannot both hold; and the viewer is still "you". */
    assert.equal(personWord('usr_b', 'usr_a', 'Mei Tan', true), 'Mei Tan')
    assert.equal(personWord('usr_a', 'usr_a', null, true), 'you')
  })

  it('§5 · G4021 — each surface hands personWord() the served former-member fact', () => {
    const approvals = read('frontend/src/components/Approvals.tsx')
    assert.match(approvals, /decidedByFormerMember/)
    assert.match(approvals, /proposedBy\.formerMember/)
    assert.match(read('frontend/src/components/Finding.tsx'), /assignedToFormerMember/)
    assert.match(read('frontend/src/components/ExceptionRegister.tsx'), /assignedToFormerMember/)
  })
})
