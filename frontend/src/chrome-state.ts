/**
 * THE CHROME'S PURE DECISIONS — what country a residency region is drawn as.
 * (What the account square says is `initials.ts`, G3588.) Plain functions in a `.ts` module so
 * `node --test` pins them without a renderer (G3473); `components/ChromeBar.tsx`
 * is their one consumer.
 */

/**
 * ⛔ THE ACCOUNT SQUARE'S INITIALS LIVED HERE TOO, UNTIL G3588 (3 Oct 2026). Two
 * helpers named `initialsOf` answered one question two ways — this one gave a
 * one-word name ONE letter (`Mei` → `M`) and took any first character,
 * punctuation included; `initials.ts` gave TWO letters and read letters only.
 * The tenant chrome drew one rule and the two consoles the other, which is
 * §5.3. The owner's ruling is *"two initials from the stored display name
 * everywhere"*, so `initials.ts` is the one derivation and this module no
 * longer declares one. The removed helper is at commit 4adf2d24.
 */

/**
 * NC-09 (G3473) — a COUNTRY for the residency REGION the plane serves, as the
 * pack draws "SG", or `null` for a region this table does not name. A closed
 * table and never a parse: `ap-southeast-1` is Singapore by AWS's own
 * definition, and there is no rule that turns a region code into a country.
 * An unknown region draws nothing — never the raw token.
 */
const RESIDENCY_COUNTRY: Readonly<Record<string, string>> = {
  'ap-southeast-1': 'SG',
  'ap-southeast-2': 'AU',
  'ap-south-1': 'IN',
  'ap-northeast-1': 'JP',
  'eu-west-1': 'IE',
  'eu-west-2': 'GB',
  'eu-central-1': 'DE',
  'us-east-1': 'US',
  'us-east-2': 'US',
  'us-west-2': 'US',
  'ca-central-1': 'CA',
}

export function countryOfResidency(residency: string | null): string | null {
  if (residency === null) return null
  return Object.hasOwn(RESIDENCY_COUNTRY, residency) ? (RESIDENCY_COUNTRY[residency] ?? null) : null
}
