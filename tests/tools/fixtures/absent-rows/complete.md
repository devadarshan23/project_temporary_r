# A fixture, not a document

Prose above the section, naming `gamma.ts` in a sentence. It is here so the row
reader is proven to read ROWS rather than the file: if this token counted,
`dropped-row.md` beside it would pass while missing gamma's row entirely, and
the negative control would assert nothing.

## Module map

| Module | Concern |
|---|---|
| `alpha.ts` | the first concern |
| `beta.ts` | the second concern |
| `gamma.ts` | the third concern |
| `tsconfig.json` | not a module; names nothing, and is not an error |

Prose below the table, also naming `delta.ts`, which is not in the fixture's
module set. If prose were read, this file would report an UNKNOWN it does not
have.
