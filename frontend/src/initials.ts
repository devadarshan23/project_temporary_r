/**
 * THE ACCOUNT SQUARE'S TWO LETTERS — N-04, the owner's ruling of 3 Oct 2026:
 * the square carries two initials from the STORED display name, and `·` only
 * when there is no name. G3484.
 *
 * The name is the directory's, stored verbatim and parsed by nothing else
 * (D6-9), so this reads it as letters and nothing more: the first letter of the
 * first word and of the last word, upper-cased. One word gives its first two
 * letters. A name with no letter in it at all (an empty string, digits,
 * punctuation) is no name, and the square says `·`.
 *
 * Letters are taken as Unicode letters (`\p{L}`), whole code points, so a name
 * in any script gives its own initials rather than a broken surrogate.
 */
export const NO_INITIALS = '·'

export function initialsOf(name: string | null | undefined): string {
  if (name === null || name === undefined) return NO_INITIALS
  const words = name
    .split(/\s+/u)
    .map((w) => Array.from(w).filter((c) => /\p{L}/u.test(c)))
    .filter((letters) => letters.length > 0)
  const first = words[0]
  if (first === undefined) return NO_INITIALS
  const last = words[words.length - 1]
  const pair = words.length === 1 || last === undefined ? first.slice(0, 2) : [first[0] ?? '', last[0] ?? '']
  return pair.join('').toLocaleUpperCase()
}
