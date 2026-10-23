#!/usr/bin/env node
/**
 * tools/planner/serve.mjs — static server + state API for the planning companion.
 *
 * Zero dependencies: node:http, node:fs, node:path only. No package.json, no build step.
 *
 *     node tools/planner/serve.mjs        # listens on 127.0.0.1:7420
 *
 * ROUTES
 *   GET  /                    tools/planner/index.html          (read fresh each request)
 *   GET  /model-graph.json    docs/model-graph.json             (read fresh each request —
 *                                                                re-run the extractor, reload,
 *                                                                no restart needed)
 *   GET  /api/state           docs/planning-state.json, created from the empty skeleton if absent
 *   POST /api/mutate          one mutation -> one log entry -> atomic persist -> whole new state
 *   GET  /api/health          { ok, graphPresent, stateEntries, logEntries }
 *
 * `stateEntries` counts the owner's substantive entries — gapStatus keys + moduleNotes keys +
 * plannedModules + plannedEdges + decisions. The append-only log is reported separately as
 * `logEntries` so a count of decisions is never confused with a count of events.
 *
 * GUARANTEES
 *   - Writes are atomic: temp file in the same directory, fsync, rename. A half-written state
 *     file would lose a planning session.
 *   - The log is append-only. No route deletes or rewrites a log entry; removePlannedEdge
 *     removes the edge and still appends an entry recording that it did.
 *   - Every enum is validated against the contract. Unknown values are rejected with 400 and a
 *     message naming the field and the permitted set — this file is read by an assistant and by
 *     git, and a typo'd disposition silently becomes a category nobody queries.
 *   - Unknown fields on a known action are rejected too, for the same reason.
 *   - JSON is written with two-space indent, sorted object keys and a trailing newline, so the
 *     git diff of a planning session is readable.
 *   - Mutations are serialised through a lock, so two concurrent POSTs cannot interleave a
 *     read-modify-write and drop one of them.
 *   - A state file that does not parse is never overwritten. The server returns 500 and says so.
 *   - Bound to 127.0.0.1 only. This holds unpublished product planning.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const fsp = fs.promises;

const HOST = '127.0.0.1';
const PORT = 7420;

const PLANNER_DIR = import.meta.dirname;
const REPO_ROOT = path.resolve(PLANNER_DIR, '..', '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const INDEX_PATH = path.join(PLANNER_DIR, 'index.html');
const GRAPH_PATH = path.join(DOCS_DIR, 'model-graph.json');
const STATE_PATH = path.join(DOCS_DIR, 'planning-state.json');

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB. A mutation envelope is a few hundred bytes.

/* ------------------------------------------------------------------ contract */

const STATE_VERSION = 1;

const DISPOSITIONS = ['open', 'accepted', 'rejected', 'deferred', 'done'];
const PLANNED_MODULE_STATUSES = ['proposed', 'agreed', 'building', 'done', 'dropped'];
const DECISION_STATUSES = ['open', 'decided', 'superseded'];

/** Permitted envelope fields per action. Anything else is a 400. */
const ACTIONS = {
  setGapStatus: { required: ['gapId', 'disposition'], optional: ['note', 'owner'] },
  setModuleNote: { required: ['module'], optional: ['note'] },
  addPlannedModule: { required: ['name'], optional: ['purpose', 'holds'] },
  setPlannedModule: { required: ['name', 'status'], optional: [] },
  addPlannedEdge: { required: ['from', 'field', 'to'], optional: ['typedAs', 'why'] },
  removePlannedEdge: { required: ['index'], optional: [] },
  addDecision: { required: ['question'], optional: ['choice', 'rationale'] },
  setDecision: { required: ['id'], optional: ['status', 'choice', 'rationale'] },
};

/** The empty skeleton, verbatim from the contract. */
function emptyState(at) {
  return {
    version: STATE_VERSION,
    updatedAt: at,
    gapStatus: {},
    moduleNotes: {},
    plannedModules: [],
    plannedEdges: [],
    decisions: [],
    log: [],
  };
}

/** Containers the state file must hold, and the shape each must have. */
const CONTAINERS = {
  gapStatus: 'object',
  moduleNotes: 'object',
  plannedModules: 'array',
  plannedEdges: 'array',
  decisions: 'array',
  log: 'array',
};

/* -------------------------------------------------------------------- errors */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);

function oneOf(field, value, permitted) {
  if (typeof value !== 'string' || !permitted.includes(value)) {
    throw bad(
      `${field} must be one of: ${permitted.join(' | ')} — received ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function requiredString(envelope, field) {
  const value = envelope[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw bad(`${field} is required and must be a non-empty string — received ${JSON.stringify(value)}`);
  }
  return value.trim();
}

function optionalString(envelope, field, fallback = '') {
  if (!(field in envelope) || envelope[field] === null || envelope[field] === undefined) {
    return fallback;
  }
  const value = envelope[field];
  if (typeof value !== 'string') {
    throw bad(`${field} must be a string — received ${JSON.stringify(value)}`);
  }
  return value;
}

function optionalStringArray(envelope, field) {
  if (!(field in envelope) || envelope[field] === null || envelope[field] === undefined) return [];
  const value = envelope[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw bad(`${field} must be an array of strings — received ${JSON.stringify(value)}`);
  }
  return value.map((item) => item.trim()).filter((item) => item !== '');
}

/* --------------------------------------------------------------- json on disk */

/** Recursively rebuild with sorted object keys. Array order is meaningful and is preserved. */
function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalise(value[key]);
    return out;
  }
  return value;
}

/** Two-space indent, sorted keys, trailing newline. It is git-tracked; it must diff cleanly. */
function serialise(value) {
  return `${JSON.stringify(canonicalise(value), null, 2)}\n`;
}

/** Temp file in the same directory, fsync, rename. Never a half-written state file. */
async function writeAtomic(target, text) {
  const dir = path.dirname(target);
  const tmp = path.join(
    dir,
    `.${path.basename(target)}.tmp-${process.pid}-${Date.now().toString(36)}`,
  );
  let handle;
  try {
    handle = await fsp.open(tmp, 'w', 0o644);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    if (handle) await handle.close();
  }
  try {
    await fsp.rename(tmp, target);
  } catch (err) {
    await fsp.rm(tmp, { force: true });
    throw err;
  }
  // Best effort: durably record the rename itself. Not fatal where unsupported.
  try {
    const dirHandle = await fsp.open(dir, 'r');
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    /* directory fsync is unavailable on some platforms; the rename still stands */
  }
}

/* --------------------------------------------------------------------- state */

/**
 * Fill in missing containers; refuse to touch a file whose containers are the wrong shape.
 * Dropping a malformed `log` to reinitialise it would silently destroy the append-only record.
 */
function normaliseState(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(
      500,
      'docs/planning-state.json must contain a JSON object. Refusing to overwrite it — fix or move the file, then retry.',
    );
  }
  const state = { ...parsed };

  if (typeof state.version !== 'number') state.version = STATE_VERSION;
  if (typeof state.updatedAt !== 'string') state.updatedAt = new Date().toISOString();

  for (const [key, shape] of Object.entries(CONTAINERS)) {
    const value = state[key];
    if (value === undefined || value === null) {
      state[key] = shape === 'array' ? [] : {};
      continue;
    }
    const ok =
      shape === 'array'
        ? Array.isArray(value)
        : typeof value === 'object' && !Array.isArray(value);
    if (!ok) {
      throw new HttpError(
        500,
        `docs/planning-state.json: "${key}" must be ${shape === 'array' ? 'an array' : 'an object'}. Refusing to overwrite it — fix or move the file, then retry.`,
      );
    }
  }
  return state;
}

async function readStateFile() {
  let raw;
  try {
    raw = await fsp.readFile(STATE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new HttpError(
      500,
      `docs/planning-state.json is not valid JSON (${err.message}). Refusing to overwrite it — fix or move the file, then retry.`,
    );
  }
  return normaliseState(parsed);
}

/** Read the state, creating it from the empty skeleton if absent. */
async function loadOrCreateState(at) {
  const existing = await readStateFile();
  if (existing) return existing;
  const fresh = emptyState(at);
  await fsp.mkdir(DOCS_DIR, { recursive: true });
  await writeAtomic(STATE_PATH, serialise(fresh));
  return fresh;
}

/* ----------------------------------------------------------------- mutations */

function assertEnvelopeShape(envelope) {
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw bad('Request body must be a JSON object: { "action": "...", ... }');
  }
  const { action } = envelope;
  if (typeof action !== 'string' || !(action in ACTIONS)) {
    throw bad(
      `action must be one of: ${Object.keys(ACTIONS).join(' | ')} — received ${JSON.stringify(action)}`,
    );
  }
  const spec = ACTIONS[action];
  const permitted = new Set(['action', ...spec.required, ...spec.optional]);
  const unknown = Object.keys(envelope).filter((key) => !permitted.has(key));
  if (unknown.length > 0) {
    throw bad(
      `${action}: unknown field${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => JSON.stringify(k)).join(', ')} — permitted fields are: ${[...permitted].join(' | ')}`,
    );
  }
  return action;
}

function nextDecisionId(decisions) {
  let max = 0;
  for (const decision of decisions) {
    const match = /^dec-(\d+)$/.exec(String(decision?.id ?? ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `dec-${String(max + 1).padStart(3, '0')}`;
}

const trim = (text, limit = 120) =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

/**
 * Apply exactly one mutation. Returns the log entry to append — the caller appends it, so
 * "one mutation, one log entry" is structural rather than a convention each branch must remember.
 */
function applyMutation(state, envelope, at) {
  const action = assertEnvelopeShape(envelope);

  switch (action) {
    case 'setGapStatus': {
      const gapId = requiredString(envelope, 'gapId');
      const disposition = oneOf('disposition', envelope.disposition, DISPOSITIONS);
      const note = optionalString(envelope, 'note');
      const owner = optionalString(envelope, 'owner');
      const previous = state.gapStatus[gapId]?.disposition ?? 'unset';
      state.gapStatus[gapId] = { disposition, note, owner, at };
      return {
        at,
        action,
        target: gapId,
        detail: `disposition ${previous} -> ${disposition}${owner ? ` (owner ${owner})` : ''}${note ? `; note: ${trim(note)}` : ''}`,
      };
    }

    case 'setModuleNote': {
      const module = requiredString(envelope, 'module');
      const note = optionalString(envelope, 'note');
      const existed = Object.prototype.hasOwnProperty.call(state.moduleNotes, module);
      state.moduleNotes[module] = { note, at };
      return {
        at,
        action,
        target: module,
        detail: `${existed ? 'replaced' : 'set'} note (${note.length} chars)${note ? `: ${trim(note)}` : ''}`,
      };
    }

    case 'addPlannedModule': {
      const name = requiredString(envelope, 'name');
      if (state.plannedModules.some((entry) => entry?.name === name)) {
        throw bad(
          `addPlannedModule: a planned module named ${JSON.stringify(name)} already exists — use setPlannedModule to change its status`,
        );
      }
      const purpose = optionalString(envelope, 'purpose');
      const holds = optionalStringArray(envelope, 'holds');
      state.plannedModules.push({ name, purpose, holds, status: 'proposed', at });
      return {
        at,
        action,
        target: name,
        detail: `proposed${purpose ? `: ${trim(purpose)}` : ''}${holds.length ? `; holds ${holds.join(', ')}` : ''}`,
      };
    }

    case 'setPlannedModule': {
      const name = requiredString(envelope, 'name');
      const status = oneOf('status', envelope.status, PLANNED_MODULE_STATUSES);
      const entry = state.plannedModules.find((candidate) => candidate?.name === name);
      if (!entry) {
        throw bad(
          `setPlannedModule: no planned module named ${JSON.stringify(name)} — known: ${state.plannedModules.map((m) => m?.name).filter(Boolean).join(', ') || '(none)'}`,
        );
      }
      const previous = entry.status ?? 'unset';
      entry.status = status;
      entry.at = at;
      return { at, action, target: name, detail: `status ${previous} -> ${status}` };
    }

    case 'addPlannedEdge': {
      const from = requiredString(envelope, 'from');
      const field = requiredString(envelope, 'field');
      const to = requiredString(envelope, 'to');
      const typedAs = optionalString(envelope, 'typedAs');
      const why = optionalString(envelope, 'why');
      state.plannedEdges.push({ from, field, to, typedAs, why, at });
      return {
        at,
        action,
        target: `${from}.${field} -> ${to}`,
        detail: `${typedAs ? `typedAs ${typedAs}` : 'no declared type'}${why ? `; ${trim(why)}` : ''}`,
      };
    }

    case 'removePlannedEdge': {
      const index = envelope.index;
      if (!Number.isInteger(index)) {
        throw bad(`index must be an integer — received ${JSON.stringify(index)}`);
      }
      if (index < 0 || index >= state.plannedEdges.length) {
        throw bad(
          `index ${index} is out of range — plannedEdges holds ${state.plannedEdges.length} entr${state.plannedEdges.length === 1 ? 'y' : 'ies'} (valid: ${state.plannedEdges.length === 0 ? 'none' : `0..${state.plannedEdges.length - 1}`})`,
        );
      }
      const [removed] = state.plannedEdges.splice(index, 1);
      // The edge goes; the record that it went does not. The log is append-only.
      return {
        at,
        action,
        target: `${removed?.from ?? '?'}.${removed?.field ?? '?'} -> ${removed?.to ?? '?'}`,
        detail: `removed at index ${index}${removed?.typedAs ? ` (typedAs ${removed.typedAs})` : ''}${removed?.why ? `; was: ${trim(removed.why)}` : ''}`,
      };
    }

    case 'addDecision': {
      const question = requiredString(envelope, 'question');
      const choice = optionalString(envelope, 'choice');
      const rationale = optionalString(envelope, 'rationale');
      const id = nextDecisionId(state.decisions);
      state.decisions.push({ id, question, choice, rationale, status: 'open', at });
      return { at, action, target: id, detail: `open: ${trim(question)}` };
    }

    case 'setDecision': {
      const id = requiredString(envelope, 'id');
      const entry = state.decisions.find((candidate) => candidate?.id === id);
      if (!entry) {
        throw bad(
          `setDecision: no decision with id ${JSON.stringify(id)} — known: ${state.decisions.map((d) => d?.id).filter(Boolean).join(', ') || '(none)'}`,
        );
      }
      const touches = ['status', 'choice', 'rationale'].filter((field) => field in envelope);
      if (touches.length === 0) {
        throw bad('setDecision: supply at least one of: status | choice | rationale');
      }
      const changes = [];
      if ('status' in envelope) {
        const status = oneOf('status', envelope.status, DECISION_STATUSES);
        changes.push(`status ${entry.status ?? 'unset'} -> ${status}`);
        entry.status = status;
      }
      if ('choice' in envelope) {
        const choice = optionalString(envelope, 'choice');
        changes.push(`choice: ${trim(choice) || '(cleared)'}`);
        entry.choice = choice;
      }
      if ('rationale' in envelope) {
        const rationale = optionalString(envelope, 'rationale');
        changes.push(`rationale: ${trim(rationale) || '(cleared)'}`);
        entry.rationale = rationale;
      }
      entry.at = at;
      return { at, action, target: id, detail: changes.join('; ') };
    }

    default:
      // Unreachable: assertEnvelopeShape already rejected unknown actions.
      throw bad(`Unhandled action ${JSON.stringify(action)}`);
  }
}

/* ------------------------------------------------------------------ the lock */

let queue = Promise.resolve();

/** Serialise read-modify-write so two concurrent POSTs cannot drop one another's mutation. */
function withLock(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function mutate(envelope) {
  return withLock(async () => {
    const at = new Date().toISOString();
    const state = await loadOrCreateState(at);
    const logEntry = applyMutation(state, envelope, at); // throws before anything is persisted
    state.log.push(logEntry); // exactly one entry per mutation, appended, never rewritten
    state.updatedAt = at;
    state.version = STATE_VERSION;
    await fsp.mkdir(DOCS_DIR, { recursive: true });
    await writeAtomic(STATE_PATH, serialise(state));
    return state;
  });
}

/* --------------------------------------------------------------------- http */

function sendJson(res, status, payload) {
  const body = Buffer.from(serialise(payload), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, `Request body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Serve a file fresh from disk. Returns false if it is not there. */
async function serveFile(res, filePath) {
  let contents;
  try {
    contents = await fsp.readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return false;
    throw err;
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    'content-length': contents.length,
    'cache-control': 'no-store',
  });
  res.end(contents);
  return true;
}

const MISSING_INDEX = `<!doctype html><meta charset="utf-8"><title>planner</title>
<pre style="font:14px ui-monospace,monospace;padding:2rem;line-height:1.6">
tools/planner/index.html is not present yet.

The server is running and the API is live:

  GET  /api/health
  GET  /api/state
  POST /api/mutate
  GET  /model-graph.json   (run \`node tools/planner/extract.mjs --write\` to produce it)
</pre>`;

const MISSING_GRAPH = {
  error: 'docs/model-graph.json is not present',
  detail: 'Run `node tools/planner/extract.mjs --write` to derive it, then reload. No restart needed. The bare command reports only and writes nothing.',
};

async function route(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';

  if (pathname === '/') {
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'GET only');
    if (await serveFile(res, INDEX_PATH)) return;
    sendText(res, 404, MISSING_INDEX, 'text/html; charset=utf-8');
    return;
  }

  if (pathname === '/model-graph.json') {
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'GET only');
    // Read fresh from disk every request: re-running the extractor is picked up on reload.
    if (await serveFile(res, GRAPH_PATH)) return;
    sendJson(res, 404, MISSING_GRAPH);
    return;
  }

  if (pathname === '/api/health') {
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'GET only');
    let graphPresent = false;
    try {
      await fsp.access(GRAPH_PATH, fs.constants.R_OK);
      graphPresent = true;
    } catch {
      graphPresent = false;
    }
    let stateEntries = 0;
    let logEntries = 0;
    try {
      const state = await readStateFile();
      if (state) {
        stateEntries =
          Object.keys(state.gapStatus).length +
          Object.keys(state.moduleNotes).length +
          state.plannedModules.length +
          state.plannedEdges.length +
          state.decisions.length;
        logEntries = state.log.length;
      }
    } catch {
      // Health must answer even when the state file is unreadable; the counts stay zero.
    }
    sendJson(res, 200, { ok: true, graphPresent, stateEntries, logEntries });
    return;
  }

  if (pathname === '/api/state') {
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'GET only');
    const state = await loadOrCreateState(new Date().toISOString());
    sendJson(res, 200, state);
    return;
  }

  if (pathname === '/api/mutate') {
    if (method !== 'POST') throw new HttpError(405, 'POST only');
    const raw = await readBody(req);
    let envelope;
    try {
      envelope = JSON.parse(raw || 'null');
    } catch (err) {
      throw bad(`Request body is not valid JSON: ${err.message}`);
    }
    const state = await mutate(envelope);
    sendJson(res, 200, state);
    return;
  }

  // Anything else inside tools/planner, in case the UI is split across files. Contained
  // to that directory; no traversal, no reaching the rest of the repository.
  if (method === 'GET' || method === 'HEAD') {
    const candidate = path.join(PLANNER_DIR, path.normalize(pathname).replace(/^[/\\]+/, ''));
    const contained =
      candidate === PLANNER_DIR || candidate.startsWith(PLANNER_DIR + path.sep);
    if (contained && (await serveFile(res, candidate))) return;
  }

  throw new HttpError(404, `No route for ${method} ${pathname}`);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500 && !(err instanceof HttpError)) {
      console.error(`[planner] ${req.method} ${req.url}`, err);
    }
    sendJson(res, status, { error: err.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[planner] http://${HOST}:${PORT}`);
  console.log(`[planner] graph  ${path.relative(REPO_ROOT, GRAPH_PATH)} (derived; re-run \`extract.mjs --write\`, then reload)`);
  console.log(`[planner] state  ${path.relative(REPO_ROOT, STATE_PATH)} (yours; git-tracked)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[planner] port ${PORT} is already in use — another planner is probably running.`);
    process.exit(1);
  }
  throw err;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Do not let an idle keep-alive connection hold the process open.
    setTimeout(() => process.exit(0), 500).unref();
  });
}
