/**
 * Synthesise the REAL app and print every stack's template as one JSON object on
 * stdout, keyed by stack name.
 *
 * ⚠️ IT SYNTHESISES THE APP `bin/app.ts` SYNTHESISES — `buildApp()`, the same
 * function, not a second tree assembled for the convenience of the tests. A test
 * that builds its own stack is a test of its own stack.
 *
 * This exists so `tests/infra/*.test.mjs` can assert against real templates
 * without spawning the `cdk` CLI (seconds) or depending on a `cdk.out` some
 * earlier command may or may not have written.
 */

import { buildApp } from '../lib/app.ts'

const assembly = buildApp().synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))
