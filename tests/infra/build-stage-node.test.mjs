/**
 * G3271–G3274 — THE BUILD STAGE AND THE GATE RUN THE SAME NODE MAJOR.
 *
 * ┌─ 🛑 THE FINDING, FROM A LIVE PIPELINE RUN ON 2 Oct 2026 ──────────────────┐
 * │ The Build stage ran `npm run build:frontend` on the curated AL2 aarch64   │
 * │ image, whose Node is 18.20.8. `frontend/site/src/prerender.tsx` read      │
 * │ `import.meta.dirname` (Node >= 20.11), got `undefined`, and `join()`      │
 * │ threw ERR_INVALID_ARG_TYPE. The GATE had run the same command green on    │
 * │ Node 22 a stage earlier: two stages, two definitions of "node".           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NOTHING HERE REACHES AWS. What is assertable at `npm run check` is the
 * declaration: the gate image's Node major, `engines.node`'s major and the
 * Build buildspec's `runtime-versions` pin are ONE number, the Build project
 * uses an image that is not the AL2 one, and the Build buildspec's INSTALL
 * guard refuses a different major. Whether the curated image actually serves
 * `nodejs: 22` is a fact about AWS (G3273, named on the stack's face).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { REPO_ROOT, ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'

await ensureDeps()

const templates = synthesisedTemplates()
const PIPELINE = 'reconcile-pipeline-staging'

const enginesMajor = (() => {
  const range = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).engines.node
  const m = /^>=(\d+)\./.exec(range)
  assert.ok(m, `engines.node is ${range}; this suite reads one form, >=x.y.z`)
  return m[1]
})()

function buildProject() {
  const found = resourcesOfType(templates[PIPELINE], 'AWS::CodeBuild::Project').filter(([, r]) =>
    String(r.Properties?.Name ?? '').startsWith('reconcile-build-'),
  )
  assert.equal(found.length, 1, `expected exactly one reconcile-build-* project, found ${found.length}`)
  return found[0][1]
}

test('test_the_gate_image_carries_the_engines_node_major', () => {
  const dockerfile = readFileSync(join(REPO_ROOT, 'infra/ci-image/Dockerfile'), 'utf8')
  const m = /^\s*nodejs(\d+)-\d+\.\d+\.\d+/m.exec(dockerfile)
  assert.ok(m, 'infra/ci-image/Dockerfile installs no versioned nodejsNN package')
  assert.equal(m[1], enginesMajor, 'the gate image Node major must equal engines.node major')
})

test('test_the_build_buildspec_pins_the_same_node_major_as_the_gate', () => {
  const spec = parseYaml(buildProject().Properties.Source.BuildSpec)
  const pinned = spec?.phases?.install?.['runtime-versions']?.nodejs
  assert.equal(
    String(pinned),
    enginesMajor,
    'G3272: the Build stage must pin runtime-versions nodejs to the gate/engines major — ' +
      'without it the curated image runs its DEFAULT Node (18 on AL2), which is the 2 Oct 2026 failure',
  )
})

test('test_the_build_install_guard_refuses_a_different_node_major', () => {
  const spec = parseYaml(buildProject().Properties.Source.BuildSpec)
  const guard = (spec.phases.install.commands ?? []).join('\n')
  assert.match(guard, /engines\.node/, 'the INSTALL guard must read the major from engines.node')
  assert.match(guard, /process\.versions\.node/, 'the INSTALL guard must compare the RUNNING node')
  assert.match(guard, /process\.exit\(1\)/, 'the INSTALL guard must fail, not warn')
})

test('test_the_build_project_is_not_on_the_al2_image_whose_runtimes_stop_short_of_node_22', () => {
  const image = buildProject().Properties.Environment.Image
  assert.notEqual(
    image,
    'aws/codebuild/amazonlinux2-aarch64-standard:3.0',
    'G3273: AL2 aarch64 3.0 defaults to Node 18 and offers no nodejs 22 runtime',
  )
  assert.equal(image, 'aws/codebuild/amazonlinux-aarch64-standard:3.0')
})

/* ── A LANDMARK, NAMED AS ONE: the pin above is the property; this only keeps
 *    the one API that bit from returning to code the frontend build executes. */

const BANNED = /(?<!`)import\.meta\.(dirname|filename)\b/

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('dist')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* sources(p)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) yield p
  }
}

test('test_the_landmark_detector_is_not_vacuous', () => {
  assert.ok(BANNED.test('const D = import.meta.dirname'))
  assert.ok(!BANNED.test('NOT `import.meta.dirname`, which is Node >= 20.11'))
})

test('test_no_frontend_build_source_reads_import_meta_dirname_or_filename', () => {
  const files = [...sources(join(REPO_ROOT, 'frontend'))]
  assert.ok(files.length > 20, `scanned only ${files.length} frontend files`)
  const hits = files.filter((f) => BANNED.test(readFileSync(f, 'utf8'))).map((f) => relative(REPO_ROOT, f))
  assert.deepEqual(hits, [], 'use dirname(fileURLToPath(import.meta.url)) — the Build stage history is G3271')
})
