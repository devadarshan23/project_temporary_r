<!--
M4 — the branch. Three rows, one of each cause the header of
`tools/check-g-numbers.mjs` enumerates.

  G60 — AMENDED IN PLACE HERE. The G60/G75/G185 shape: trunk's own text is
        preserved verbatim and appended to. Cause (c), this record's normal
        operation, and NOT a collision. Present at the fork point.
  G61 — untouched here; trunk amended it. Cause (b), a stale branch, and NOT a
        collision. Present at the fork point.
  G62 — MINTED HERE, for a different ruling, while trunk had already spent the
        number. Cause (a). ABSENT at the fork point. THE COLLISION.

Expected verdict: exactly [62].
-->

| G60 | staff may not reach `secret` | statutory and secret are both unreachable at any price 🛑 AMENDED BY G75 — the FDE may reach `secret`; `statutory` alone survives | — |
| G61 | one money codec module | nothing else may touch the representation | — |
| G62 | every branded id is `text` | the slug is stored verbatim and compares like-for-like against `current_setting` | — |
