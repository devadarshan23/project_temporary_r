<!--
M4 — `origin/main`. Three rows.

  G60 — untouched since the fork.
  G61 — AMENDED BY TRUNK after the fork. Cause (b): a stale branch, not a
        collision. The branch below still carries the fork point's text, so a
        branch-to-trunk byte comparison flags it and must not.
  G62 — MINTED BY TRUNK after the fork, for trunk's own ruling.
-->

| G60 | staff may not reach `secret` | statutory and secret are both unreachable at any price | — |
| G61 | one money codec module | nothing else may touch the representation | ✅ applied — landed in `db/money.ts` |
| G62 | transaction-mode pooling from day one | `SET LOCAL` inside an explicit transaction is correct under both modes | — |
