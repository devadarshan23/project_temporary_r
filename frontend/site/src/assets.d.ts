/**
 * Vite resolves an imported image to its emitted URL. `frontend/tsconfig.json`
 * loads `node` types only, not `vite/client`, so the one shape the apex site
 * uses is declared here rather than pulling every Vite ambient into the
 * application's program.
 */
declare module '*.jpg' {
  const src: string
  export default src
}
