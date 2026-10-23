<!--
M5 — a FENCED code block, triple backticks, not inline ones. This record quotes
row syntax verbatim inside its reproduce commands, in CLAUDE.md, in
docs/HANDOFF.md and in issue bodies. A scanner that does not track fences
registers every one of them as a ruling.

Inline backticks are NOT this control: `| G186 |` on a prose line already fails
the `^| G` anchor on its own, so a fixture built from inline backticks asserts
nothing about fence tracking — deleting the fence lines from parseGRows leaves
it passing. The block below starts at column 0 and would parse as a row if the
fence were not honoured.

This file must yield exactly one row: G191.
-->

Reproduce the collision:

```bash
grep -c '^| G186 |' docs/HANDOFF.md
```

And the row shape the reproduce command is quoting looks like this:

```
| G186 | a quoted specimen row, not a ruling |
| G187 | a second quoted specimen row |
```

| G191 | the only real row in this file | ✅ |
