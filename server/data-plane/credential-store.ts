/**
 * ════════════════════════════════════════════════════════════════════════════
 * WHERE A SOURCE CREDENTIAL GOES — THE SEAM, AND ONLY THE SEAM.
 * G2401, THE OWNER'S RULING OF 1 Oct 2026, quoted rather than paraphrased:
 *   *"Source credential custody: Secrets Manager, one secret per source,
 *     encrypted with the tenant's per-tenant KMS key (Storage's key factory);
 *     only a credentialRef lives in Postgres; the FDE binds a credential via a
 *     write path under G75's secret reach."*
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🛑 THIS MODULE CAN WRITE A CREDENTIAL AND CANNOT READ ONE, AND THAT IS ITS
 * SHAPE RATHER THAN AN OMISSION. `CredentialStore` is ONE function whose only
 * input is a value to store and whose only output is whether it was stored.
 * There is no `get`, no `describe`, no `list` — so no handler in this process
 * can be written that reads a credential back, whatever it is given. The reader
 * of a credential is the CONNECTOR that pulls a source, and it is not built;
 * `infra/lib/storage-stack.ts` withholds `secretsmanager:GetSecretValue` from
 * the serving role AND withholds `kms:Decrypt`-via-Secrets-Manager on the
 * tenant key, so read-back would be refused three times over.
 * `tests/http/credential-binding-served.test.ts` §8 asserts the export surface.
 *
 * ⚠️ IT IS A SEAM WITH A DYNAMIC IMPORT FOR `run-queue.ts`'s REASON EXACTLY.
 * A plane with no store configured never LOADS `secrets-manager-store.ts`, so
 * it never constructs an AWS client and never looks for credentials of its
 * own; the SDK has one home per service and both are reached this way
 * (`tests/ci/aws-sdk-scope.test.ts`).
 *
 * ⚠️ AND AN UNCONFIGURED PLANE REFUSES LOUDLY RATHER THAN STORING NOTHING. The
 * run queue's unconfigured publisher LOGS and lets the act succeed, because a
 * run row with no message is recoverable by pressing Run again. A credential
 * that was "bound" and stored nowhere is not recoverable — the person who typed
 * it believes it is in force — so the unconfigured store answers
 * `store_not_configured` and the bind is a 500, with nothing written.
 */

/** What one bind asks the store to do. The value never leaves this object. */
export interface CredentialWrite {
  /** Opaque; built by `secretNameFor()` from a RANDOM handle. Never a tenant id. */
  readonly secretName: string
  /** The TENANT's key, by alias. There is no field that could name another. */
  readonly keyAlias: string
  /** The credential. Logged nowhere, returned nowhere, stored in Postgres nowhere. */
  readonly value: string
  /**
   * `create` at first bind, `rotate` thereafter. ⚠️ A ROTATION CANNOT MOVE THE
   * KEY: `PutSecretValue` takes no key, and `UpdateSecret` — which can — is
   * withheld from the serving role (G2403).
   */
  readonly mode: 'create' | 'rotate'
}

export const CREDENTIAL_STORE_REFUSALS = ['store_not_configured', 'store_rejected'] as const
export type CredentialStoreRefusal = (typeof CREDENTIAL_STORE_REFUSALS)[number]

export type CredentialWriteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: CredentialStoreRefusal }

export type CredentialStore = (write: CredentialWrite) => Promise<CredentialWriteOutcome>

/**
 * The store plus the two naming rules, chosen ONCE at boot. The rules are here
 * rather than in the handler so the handler cannot spell a name or an alias
 * itself — it hands over a handle and receives a name.
 */
export interface CredentialCustody {
  readonly store: CredentialStore
  /** `credentialHandle` is 32 hex characters; anything else throws. */
  readonly secretNameFor: (credentialHandle: string) => string
  /** `keyHandle` is 16 hex characters; anything else throws. */
  readonly keyAliasFor: (keyHandle: string) => string
}

const CREDENTIAL_HANDLE = /^[0-9a-f]{32}$/
const KEY_HANDLE = /^[0-9a-f]{16}$/
/** `infra/lib/config.ts`'s `sourceCredentialSecretPrefix()`, by shape. */
const SECRET_PREFIX = /^reconcile-[a-z]+-data-cred-$/
/** `infra/lib/config.ts`'s `tenantKeyAliasPrefix()`, by shape. */
const KEY_ALIAS_PREFIX = /^alias\/reconcile-[a-z]+-data-tk-$/

/**
 * The naming rules over two prefixes, refusing anything that would let a name
 * carry something other than an opaque handle.
 *
 * ⚠️ BOTH CHECKS THROW RATHER THAN REFUSE, because the only caller is this
 * repository's own handler passing a handle it minted or read from a
 * CHECK-constrained column; a malformed one is a defect, never a request.
 */
export function namingOver(
  secretPrefix: string,
  keyAliasPrefix: string,
): Pick<CredentialCustody, 'secretNameFor' | 'keyAliasFor'> {
  if (!SECRET_PREFIX.test(secretPrefix)) {
    throw new Error(
      `G2401: '${secretPrefix}' is not a source-credential secret prefix. It must be ` +
        "`infra/lib/config.ts`'s `sourceCredentialSecretPrefix()` — the IAM grant is " +
        'fenced to exactly that prefix, so any other name is an AccessDenied at the ' +
        'first bind rather than at boot.',
    )
  }
  if (!KEY_ALIAS_PREFIX.test(keyAliasPrefix)) {
    throw new Error(
      `G2401: '${keyAliasPrefix}' is not a tenant key alias prefix. The IAM grant ` +
        'admits CreateSecret only under a key whose alias carries this prefix, so a ' +
        'credential could never be encrypted under anything else — and a plane that ' +
        'booted with another one would fail every bind.',
    )
  }
  return {
    secretNameFor: (credentialHandle) => {
      if (!CREDENTIAL_HANDLE.test(credentialHandle)) {
        throw new Error('a credential handle is 32 lowercase hex characters, minted, never derived')
      }
      return `${secretPrefix}${credentialHandle}`
    },
    keyAliasFor: (keyHandle) => {
      if (!KEY_HANDLE.test(keyHandle)) {
        throw new Error('a tenant key handle is 16 lowercase hex characters (TENANT_KEY_HANDLE_PATTERN)')
      }
      return `${keyAliasPrefix}${keyHandle}`
    },
  }
}

/** Local naming for the unconfigured and test custodies. Matches the infra shape. */
const LOCAL_NAMING = namingOver('reconcile-local-data-cred-', 'alias/reconcile-local-data-tk-')

/** The loud refusal. See the header: a credential stored nowhere is not a success. */
export function unconfiguredCredentialCustody(): CredentialCustody {
  return {
    ...LOCAL_NAMING,
    store: async () => {
      console.error(
        'data-plane: a source credential was presented for binding and NO CREDENTIAL ' +
          'STORE IS CONFIGURED, so nothing was stored and nothing was recorded as bound. ' +
          'Set `RECONCILE_CREDENTIAL_SECRET_PREFIX` and ' +
          '`RECONCILE_CREDENTIAL_KEY_ALIAS_PREFIX` (G2401).',
      )
      return { ok: false, refusal: 'store_not_configured' }
    },
  }
}

/** A custody over a caller-supplied store, for a suite to WITNESS the write. */
export function custodyOver(store: CredentialStore): CredentialCustody {
  return { ...LOCAL_NAMING, store }
}

export interface CredentialStoreTarget {
  readonly secretPrefix: string
  readonly keyAliasPrefix: string
  readonly region: string
  /** A local Secrets-Manager-compatible endpoint. Absent in AWS. */
  readonly endpoint?: string
}

const DEFAULT_REGION = 'us-west-2'

/**
 * Read once, at boot. ⚠️ NOTHING DEPLOYED SETS EITHER PREFIX: wiring them into
 * `Planes`' task definition is a `Planes` deploy (G1012), and is left to a
 * person exactly as `RECONCILE_RUN_QUEUE_URL` was (G1205). Until then the
 * deployed plane answers every bind with `store_not_configured` — loudly.
 */
export function credentialStoreTarget(): CredentialStoreTarget | null {
  const secretPrefix = process.env['RECONCILE_CREDENTIAL_SECRET_PREFIX']
  const keyAliasPrefix = process.env['RECONCILE_CREDENTIAL_KEY_ALIAS_PREFIX']
  if (
    secretPrefix === undefined ||
    secretPrefix === '' ||
    keyAliasPrefix === undefined ||
    keyAliasPrefix === ''
  ) {
    return null
  }
  const endpoint = process.env['RECONCILE_CREDENTIAL_STORE_ENDPOINT']
  const region = process.env['AWS_REGION']
  return {
    secretPrefix,
    keyAliasPrefix,
    region: region === undefined || region === '' ? DEFAULT_REGION : region,
    ...(endpoint === undefined || endpoint === '' ? {} : { endpoint }),
  }
}

export async function resolveCredentialCustody(): Promise<CredentialCustody> {
  const target = credentialStoreTarget()
  if (target === null) return unconfiguredCredentialCustody()
  const { secretsManagerCredentialCustody } = await import('./secrets-manager-store.ts')
  return secretsManagerCredentialCustody(target)
}
