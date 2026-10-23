import type { Money } from './api/exceptions.ts'

/**
 * The C1 surface's formatting, in one place, so the strip, the arrival, the
 * register and the status bar cannot spell one value two ways.
 *
 * TIMES ARE UTC AND SAY SO WHERE A DATE IS SHOWN. The pre-rendered page is
 * built once and read anywhere, and a local-time rendering would make the same
 * run read differently on the build machine and in a browser.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function parsed(iso: string): Date | null {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `03:12` — the strip's and the status bar's clock. */
export function clockOf(iso: string): string {
  const d = parsed(iso)
  return d === null ? iso : d.toISOString().slice(11, 16)
}

/** `09 Mar 03:12 UTC` — wherever a reader needs the day as well. */
export function whenOf(iso: string): string {
  const d = parsed(iso)
  if (d === null) return iso
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getUTCMonth()] ?? ''} ${clockOf(iso)} UTC`
}

/** `05 Oct 2026` — a day with no clock, for a record whose time of day says nothing. */
export function dateOf(iso: string): string {
  const d = parsed(iso)
  if (d === null) return iso
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getUTCMonth()] ?? ''} ${String(d.getUTCFullYear())}`
}

/** Grouped digits, `1,806`, for a count. */
export function countOf(n: number): string {
  return n.toLocaleString('en-GB')
}

/**
 * A money amount as the pack draws it — the unit apart and quieter, the figure
 * grouped and fixed to the currency's own exponent. Exact: the minor units are
 * a decimal STRING on the wire (G111) and are never parsed into a float here.
 */
export function moneyFigure(money: Money): { readonly unit: string; readonly figure: string } {
  const negative = money.amountMinor.startsWith('-')
  const digits = negative ? money.amountMinor.slice(1) : money.amountMinor
  const exponent = Math.max(0, money.exponent)
  const padded = digits.padStart(exponent + 1, '0')
  const whole = padded.slice(0, padded.length - exponent)
  const fraction = exponent === 0 ? '' : `.${padded.slice(padded.length - exponent)}`
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return { unit: money.currency, figure: `${negative ? '-' : ''}${grouped}${fraction}` }
}

/**
 * The sum of a set of amounts, or `null` when they are not one currency at one
 * exponent. A total across currencies is refused rather than drawn: a USD
 * invoice summed with an SGD order is a number with no unit, and the foot row is
 * the place a reader trusts most.
 */
export function sumOf(amounts: readonly Money[]): Money | null {
  const first = amounts[0]
  if (first === undefined) return null
  if (!amounts.every((m) => m.currency === first.currency && m.exponent === first.exponent)) return null
  let total = 0n
  for (const m of amounts) total += BigInt(m.amountMinor)
  return { currency: first.currency, exponent: first.exponent, amountMinor: total.toString() }
}

const WORDS = [
  'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
] as const

/** The pack's greeting spells small counts — "Five of the fourteen". */
export function wordOf(n: number): string {
  return WORDS[n] ?? countOf(n)
}

export function capitalised(s: string): string {
  return s.length === 0 ? s : `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`
}

/**
 * The greeting by the reader's own clock — the one local-time value on C1 —
 * and, since 3 Oct 2026 (RC-13), by name: the pack's *"Good morning,
 * Rosalie."* The name is the first word of the display name the person's own
 * directory asserted (`getSessionPrincipal`); with none, the greeting stands
 * alone rather than inventing one.
 */
export function greetingFor(now: Date, displayName: string | null = null): string {
  const h = now.getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = displayName?.trim().split(/\s+/)[0] ?? ''
  return first === '' ? `${part}.` : `${part}, ${first}.`
}
