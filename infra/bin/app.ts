#!/usr/bin/env node
/**
 * The CDK entry point named by `cdk.json`'s `app` key.
 *
 * `node bin/app.ts` — no `ts-node`, no build step, no loader. Node 22 strips
 * TypeScript types natively, which is the same property `engines.node` in the
 * root manifest is pinned for and the same one that lets `node --test` run
 * `tests/**\/*.test.ts` directly. An infrastructure app that needed a compile
 * step would put an artefact nothing checks between the source that is reviewed
 * and the template that is deployed.
 */

import { buildApp } from '../lib/app.ts'

buildApp().synth()
