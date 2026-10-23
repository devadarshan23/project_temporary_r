/**
 * THE MINTER'S INTAKE GUARDS — G290, and G260 arriving at a THIRD API its own
 * Aspect cannot see.
 *
 * 🛑 THIS FILE HOLDS NO AWS SDK IMPORT, DELIBERATELY. It is the half of the
 * function a test can execute with no credentials, no network and no
 * `@aws-sdk/*` on disk, and `tests/infra/tenant-key-minter.test.mjs` witnesses
 * every refusal below RED by calling it. A guard that only ever runs inside a
 * deployed Lambda is a guard nobody has seen work — `docs/HANDOFF.md` §5.6.
 *
 * ┌─ 🛑 WHY THE MINTER IS NOT TOLD WHICH TENANT IT IS MINTING FOR ────────────┐
 * │ `infra/lib/config.ts` argues that a KMS ALIAS is a tenant enumeration in  │
 * │ the clear, because `kms:ListAliases` is account-wide and takes no         │
 * │ resource. **A LAMBDA INVOCATION IS THE SAME DISCLOSURE AT A THIRD API.**  │
 * │ An event is written to the function's CloudWatch log group, it appears in │
 * │ an X-Ray segment, it is retained by whatever invoked it, and it is        │
 * │ readable by anyone holding `logs:FilterLogEvents` on one log group — none │
 * │ of which is the control-plane catalogue behind a grant.                   │
 * │                                                                           │
 * │ So the intake accepts ONE optional field, `handle`, which is sixteen      │
 * │ random hex characters and means nothing on its own. **The tenant id never │
 * │ enters AWS.** The handle-to-tenant join is the control plane's to record  │
 * │ and there is nowhere in this repository that records it — that gap is     │
 * │ named at the head of `infra/lib/storage-stack.ts` rather than papered.    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND THE REASON AN UNKNOWN FIELD IS REFUSED RATHER THAN IGNORED is the one
 * `server/http/app.ts` already states about AJV: *"Under the default,
 * `?tenantId=…` against a querystring marked `additionalProperties: false` is
 * silently deleted and the request served — which satisfies invariant 1 and
 * leaves no evidence that it did."* An intake that ignores `{tenantId: …}`
 * accepts it: the caller believes it was recorded, the log holds it, and
 * nothing anywhere says no.
 */

/**
 * The opaque handle grammar. SIXTEEN HEX CHARACTERS, and the same grammar
 * `TENANT_KEY_HANDLE_PATTERN` states in `infra/lib/config.ts`.
 *
 * ⚠️ IT IS WRITTEN TWICE AND THAT IS NAMED RATHER THAN HIDDEN. The CDK copy
 * throws at SYNTH, over a handle typed into `TENANT_KEY_HANDLES` by a human in
 * a reviewed pull request; this copy throws at RUN TIME, over a handle that
 * arrives in an event. Neither can cover the other — one runs in `tsc`'s world
 * and the other in Lambda's, and the seam between them is a zip file. What
 * keeps the two from drifting is `tests/infra/tenant-key-minter.test.mjs`,
 * which asserts this pattern's SOURCE TEXT against the one in `lib/config.ts`.
 */
export const HANDLE_PATTERN = /^[0-9a-f]{16}$/

/** The only field an invocation may carry. */
export const PERMITTED_EVENT_FIELDS = ['handle']

export class MinterRefusal extends Error {
  constructor(kind, message) {
    super(message)
    this.name = 'MinterRefusal'
    this.kind = kind
  }
}

/**
 * Read an invocation event, or refuse it.
 *
 * @param {unknown} event
 * @returns {{handle: string | undefined}}
 */
export function readRequest(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new MinterRefusal(
      'event_not_an_object',
      'G290: the minter takes a JSON object with at most one field, "handle". ' +
        `Received ${Array.isArray(event) ? 'an array' : typeof event}.`,
    )
  }

  const unknown = Object.keys(event).filter((k) => !PERMITTED_EVENT_FIELDS.includes(k))
  if (unknown.length > 0) {
    throw new MinterRefusal(
      'unknown_event_field',
      `G290/G260: this function refuses the field(s) ${JSON.stringify(unknown)}. ` +
        'It mints a key for an OPAQUE HANDLE and is never told which tenant the ' +
        'handle belongs to, because an invocation event reaches a CloudWatch log ' +
        'group and a log group is not the control-plane catalogue behind a grant. ' +
        'A tenant id in an event is the enumeration G260 refuses through a tag, ' +
        'arriving at a third API the Aspect cannot see. Ignoring the field would ' +
        'be worse than refusing it: the caller would believe it was recorded.',
    )
  }

  if (!Object.hasOwn(event, 'handle')) return { handle: undefined }

  const handle = event.handle
  if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) {
    throw new MinterRefusal(
      'handle_not_opaque',
      `G287/G260: ${JSON.stringify(handle)} is not an opaque tenant key handle. ` +
        'A handle is sixteen hex characters, minted at random and NEVER derived ' +
        'from the tenant id: tenant ids are low-entropy slugs, so a hash of one is ' +
        'recovered by guessing forward. It reaches a KMS alias, and kms:ListAliases ' +
        'is an account-wide call that takes no resource.',
    )
  }

  return { handle }
}

/**
 * Mint a handle. SIXTEEN HEX CHARACTERS FROM A CSPRNG, NEVER DERIVED.
 *
 * `randomBytes` rather than `Math.random`: the handle is the only thing
 * standing between an alias list and the customer list, so a predictable one
 * gives back what the opacity bought.
 *
 * @param {{randomBytes: (n: number) => {toString: (enc: string) => string}}} crypto
 */
export function mintHandle(crypto) {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * The configuration the function reads from its environment.
 *
 * 🛑 THE KEY POLICY IS NOT BUILT HERE. It arrives as a rendered JSON STRING in
 * `RECONCILE_TENANT_KEY_POLICY`, written by `infra/lib/storage-stack.ts`, which
 * is the ONE place a tenant key policy is stated — the narrowed root statement,
 * the single cryptographic grant to the data plane's serving task role, the
 * withheld `kms:ReEncrypt*` and the `kms:ViaService` fence. **A second
 * statement of that policy, in JavaScript, would be the defect the whole record
 * is about**: two expressions of one obligation, drifting in the direction
 * nobody notices, on the fence that makes "a key per tenant" true. This
 * function does not know what a key policy says; it carries one.
 *
 * @param {Record<string, string | undefined>} env
 */
export function readConfig(env) {
  const required = [
    'RECONCILE_KEY_ALIAS_PREFIX',
    'RECONCILE_TENANT_KEY_POLICY',
    'RECONCILE_TENANT_KEY_TAGS',
  ]
  const missing = required.filter((name) => (env[name] ?? '') === '')
  if (missing.length > 0) {
    throw new MinterRefusal(
      'configuration_absent',
      `G290: ${missing.join(', ')} is not set. This function refuses to invent a ` +
        'key policy or a tag set; both are written by the Storage stack and carried ' +
        'here as data.',
    )
  }

  const tags = JSON.parse(String(env['RECONCILE_TENANT_KEY_TAGS']))
  return {
    aliasPrefix: String(env['RECONCILE_KEY_ALIAS_PREFIX']),
    /* Parsed, not interpolated. A policy assembled by string concatenation
     * here would be a policy this file could get wrong. */
    policy: String(env['RECONCILE_TENANT_KEY_POLICY']),
    tags: Object.entries(tags).map(([Key, TagValue]) => ({ TagKey: Key, TagValue: String(TagValue) })),
  }
}
