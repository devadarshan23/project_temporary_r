# A fixture, not a document

Deliberately drifted from `complete.md` by ONE addition — a row for `delta.ts`,
which is not in the fixture's module set. A module deleted from disk and left
advertised in the table looks exactly like this, and a MISSING-only checker
would call this file complete.

## Module map

| Module | Concern |
|---|---|
| `alpha.ts` | the first concern |
| `beta.ts` | the second concern |
| `gamma.ts` | the third concern |
| `delta.ts` | a module that does not exist |

Prose below the table.
