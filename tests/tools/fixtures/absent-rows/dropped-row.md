# A fixture, not a document

Deliberately drifted from `complete.md` by ONE deletion — the `gamma.ts` row.
This is the defect G242 exists for, reduced to its smallest form: the section
still claims to be the module map, and one module has no row.

The token `gamma.ts` appears in this sentence on purpose. A reader scanning the
file rather than the table would find it and pass.

## Module map

| Module | Concern |
|---|---|
| `alpha.ts` | the first concern |
| `beta.ts` | the second concern |
| `tsconfig.json` | not a module; names nothing, and is not an error |

Prose below the table.
