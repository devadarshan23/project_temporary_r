/**
 * THE CLOSE SURFACE DRAWS ITS THREE SERVED FIGURES — G3543 · G3544, 3 Oct 2026.
 *
 * `Matched`, `In variance` (the arrival) and the register's per-line Variance
 * were drawn quiet (`Coming soon`) under G3444 / G3469 because nothing served
 * them. The plane now serves all three (G3541 `settlementTallies` on
 * `getRunAccount`, G3542 `ExceptionQueueRow.variance` on `listExceptions`), so
 * the surface draws them — and keeps the dash, never a zero, where a figure is
 * unmeasured or refused.
 *
 * WITNESSED RED against `origin/main` (ef511853): `arrivalSettlementOf`,
 * `varianceFigureOf` and `varianceCurrency` did not exist (the import failed);
 * and §3's source checks failed on `<Soon className="fig">…Matched` and on
 * `data-variance="unmeasured"`, the two quiet marks this slice removes.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO } from '../design/render.ts'
import {
  ARRIVAL_SIDE,
  arrivalSettlementOf,
  varianceCurrency,
  varianceFigureOf,
} from '../../frontend/src/close-state.ts'
import type { ExceptionRow } from '../../frontend/src/api/exceptions.ts'

const SGD = (minor: string) => ({ currency: 'SGD', amountMinor: minor, exponent: 2 })

describe('§1 · the arrival draws the served tally, and never a zero it was not given (G3543)', () => {
  it('no produced account is unmeasured, not 0', () => {
    assert.deepEqual(arrivalSettlementOf(null), { kind: 'unmeasured' })
    assert.deepEqual(arrivalSettlementOf([]), { kind: 'unmeasured' })
  })
  /* G3885 — `In variance` is the plane's `openResidual` (the owner's C3-02/C3-09
     ruling, *"'In variance' is defined as the open residual"*), NOT the arrival
     side's own unsettled total. WITNESSED RED: with `arrivalSettlementOf`
     reading `tally.unsettled` as it did before, the first case drew
     SGD 112,204.00 (left alone) where the open residual is SGD 110,000.00 net of
     the right side, and the second drew `none` where the residual is negative. */
  it('Matched is the left side; In variance is the open residual as served', () => {
    assert.equal(ARRIVAL_SIDE, 'left')
    assert.deepEqual(
      arrivalSettlementOf(
        [
          { side: 'left', matched: 1806, unsettled: { kind: 'total', total: SGD('11220400') } },
          { side: 'right', matched: 1799, unsettled: { kind: 'total', total: SGD('220400') } },
        ],
        { kind: 'total', total: SGD('11000000') },
      ),
      { kind: 'measured', matched: 1806, inVariance: { kind: 'money', money: SGD('11000000') } },
    )
  })
  it('a NEGATIVE open residual is drawn negative — the right side is over', () => {
    assert.deepEqual(
      arrivalSettlementOf(
        [
          { side: 'left', matched: 3, unsettled: { kind: 'nothing_open' } },
          { side: 'right', matched: 3, unsettled: { kind: 'total', total: SGD('59855') } },
        ],
        { kind: 'total', total: SGD('-59855') },
      ),
      { kind: 'measured', matched: 3, inVariance: { kind: 'money', money: SGD('-59855') } },
    )
  })
  it('nothing open is `none` (a dash, as C1\'s clean run), a refused sum is `mixed`', () => {
    const s = arrivalSettlementOf(
      [
        { side: 'left', matched: 9, unsettled: { kind: 'nothing_open' } },
        { side: 'right', matched: 9, unsettled: { kind: 'nothing_open' } },
      ],
      { kind: 'nothing_open' },
    )
    assert.deepEqual(s, { kind: 'measured', matched: 9, inVariance: { kind: 'none' } })
    assert.deepEqual(
      arrivalSettlementOf([{ side: 'left', matched: 2, unsettled: { kind: 'total', total: SGD('1') } }], { kind: 'mixed_units' }),
      { kind: 'measured', matched: 2, inVariance: { kind: 'mixed' } },
    )
  })
  it('an account with no openResidual is unmeasured, never the one-sided sum', () => {
    assert.deepEqual(
      arrivalSettlementOf([{ side: 'left', matched: 2, unsettled: { kind: 'total', total: SGD('500') } }], null),
      { kind: 'unmeasured' },
    )
  })
})

describe('§2 · the register\'s Variance cell draws the sign AS SERVED (G3544, amended G3884)', () => {
  /* G3884 — the `+` the cell added to every non-negative figure is gone: the
     plane serves a SIGNED variance since G3803, so `over` is positive and
     `under` negative on the wire and nothing is added here. WITNESSED RED: the
     previous `varianceFigureOf` answered '+18,340.00' for the first case. */
  it('a positive variance is drawn as served (no added `+`), a negative its `-`, a zero neither', () => {
    assert.deepEqual(varianceFigureOf(SGD('1834000')), { unit: 'SGD', figure: '18,340.00' })
    assert.deepEqual(varianceFigureOf(SGD('-500')), { unit: 'SGD', figure: '-5.00' })
    assert.deepEqual(varianceFigureOf(SGD('0')), { unit: 'SGD', figure: '0.00' })
  })
  it('a null variance is no figure — the cell draws the dash', () => {
    assert.equal(varianceFigureOf(null), null)
  })
  it('the column names a unit only when every line carrying a variance shares it', () => {
    const row = (variance: ExceptionRow['variance']): ExceptionRow => ({ variance }) as ExceptionRow
    assert.equal(varianceCurrency([row(SGD('1')), row(null), row(SGD('2'))]), 'SGD')
    assert.equal(varianceCurrency([row(SGD('1')), row({ currency: 'USD', amountMinor: '1', exponent: 2 })]), null)
    assert.equal(varianceCurrency([row(null)]), null)
  })
})

describe('§3 · the two quiet marks are gone from the source', () => {
  const src = (p: string): string => readFileSync(join(REPO, 'frontend', 'src', p), 'utf8')
  it('Matched and In variance are no longer drawn inside <Soon>', () => {
    const shell = src('Shell.tsx')
    assert.doesNotMatch(shell, /<Soon className="fig">\s*<span className="k">(Matched|In variance)</)
    assert.match(shell, /data-figure="matched"/)
    assert.match(shell, /data-figure="in-variance"/)
  })
  it('the Variance cell is no longer the constant unmeasured dash', () => {
    assert.doesNotMatch(src('components/ExceptionRegister.tsx'), /data-variance="unmeasured"/)
  })
})
