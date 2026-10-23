# Planning companion

1. `node tools/planner/extract.mjs --write` (or `npm run graph`) — derives `docs/model-graph.json` from `model/`. ⚠️ **The bare command without `--write` reports and writes nothing**, deliberately: it used to write unconditionally, and `npm test` ran it, so every test run dirtied a committed artefact. The file is it is generated output, never hand-edited, and safe to re-run at any time.
2. `node tools/planner/serve.mjs` — serves the UI and the state API on `http://127.0.0.1:7420` (loopback only; this holds unpublished product planning).
3. Open <http://127.0.0.1:7420> — the graph is read fresh from disk on every request, so re-running the extractor needs only a reload, not a restart.
4. Your decisions land in `docs/planning-state.json` — written solely by the server (atomically, sorted, two-space indent), **meant to be committed**, and never touched by the extractor.
