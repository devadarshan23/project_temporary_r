/**
 * THE PACK'S ROUTE TABLE, PARSED — ONE PARSER, TWO CALLERS (G4414, 5 Oct 2026).
 *
 * `tests/app/route-provenance.test.ts` carried this parser privately, and the
 * C4 page's route register (`tools/planner/c4-frontend.mjs`) needs the same
 * rows. A second copy would be §5.3 — two implementations of one rule, and the
 * one that drifts is always the copy — so the parser MOVED here and both
 * import it. The assertions it carried are kept as thrown errors with the same
 * words: a parser keyed on column POSITION reads the wrong column for four of
 * the thirteen rows, so a renamed header must stop the caller rather than shift
 * it silently onto the neighbouring cell.
 *
 * Nothing here states a path. Every value is read out of
 * `docs/handoff-pack/User Journeys.dc.html`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const JOURNEYS = join(REPO, 'docs', 'handoff-pack', 'User Journeys.dc.html')

/**
 * The `rt-route` rows, with every value read by COLUMN NAME.
 *
 * ⚠️ THE TWO TABLES CARRY DIFFERENT COLUMNS — the public-plane table drops
 * *Identity provider* — so each table's own `<thead>` supplies the index.
 */
export function packRoutes(journeysPath = JOURNEYS) {
  const html = readFileSync(journeysPath, 'utf8')
  const out = []
  for (const table of html.match(/<table[^>]*>[\s\S]*?<\/table>/g) ?? []) {
    if (!table.includes('rt-route')) continue
    const heads = [...table.matchAll(/<th scope="col"[^>]*>([^<]*)<\/th>/g)]
      .map((m) => (m[1] ?? '').trim().toLowerCase())
    const planeAt = heads.indexOf('plane')
    const existsAt = heads.indexOf('exists')
    if (!(planeAt > 0 && existsAt > 0)) {
      throw new Error(
        'A table carrying `rt-route` rows has no `Plane` or no `Exists` column header. ' +
          'This parser reads both BY NAME on purpose — the two route tables in ' +
          '"User Journeys.dc.html" do not share a column list — so a renamed header must ' +
          'stop the suite rather than shift it silently onto the neighbouring cell. ' +
          `Headers seen: ${JSON.stringify(heads)}`,
      )
    }
    for (const row of table.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
      const route = /<th scope="row" class="rt-route">([^<]*)<\/th>/.exec(row)?.[1]
      if (route === undefined) continue
      /* The route cell is column 0; the `<td>`s that follow are columns 1..n. */
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => (m[1] ?? '').trim())
      const plane = cells[planeAt - 1]
      const exists = cells[existsAt - 1]
      if (plane === undefined || exists === undefined) {
        throw new Error(
          `The \`rt-route\` row for "${route}" is short of the columns its own table declares. ` +
            `Expected a cell at Plane (${String(planeAt)}) and Exists (${String(existsAt)}); ` +
            `the row carries ${String(cells.length)} data cells.`,
        )
      }
      out.push({ route: route.trim(), plane: plane.toLowerCase(), exists: exists.toLowerCase() })
    }
  }
  return out
}

/** A pack route cell that names a URL rather than a surface, normalised. */
export function asPath(route) {
  if (!route.startsWith('/')) return null
  /* `/setup/*` spells a SUBTREE. `resolve()` takes concrete pathnames, so the
     wildcard suffix is dropped and the base is what the two sets compare on.
     Nothing else in the pack uses the form; a second wildcard shape would fall
     through to the literal and show up as an unexplained difference. */
  return route.endsWith('/*') ? route.slice(0, -2) : route
}
