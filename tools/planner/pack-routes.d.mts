/** Types for `pack-routes.mjs` — the pack's route table, parsed (G4414). */
export interface PackRoute {
  /** The cell's own text — a path, or a surface name like `staff console`. */
  readonly route: string
  /** `data` · `control` · `public`, read from the row's Plane column. */
  readonly plane: string
  /** `built` · `partial` · `specified` · `neither`, read from the Exists column. */
  readonly exists: string
}
export declare const JOURNEYS: string
export declare function packRoutes(journeysPath?: string): readonly PackRoute[]
export declare function asPath(route: string): string | null
