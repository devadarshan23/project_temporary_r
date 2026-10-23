/**
 * The rotation function's configuration and its refusals — G3921–G3925.
 *
 * Every value here is set by `infra/lib/data-stack.ts` on ONE function bound to
 * ONE role secret. Nothing is read from the invocation except the step, the
 * secret id and the token, and the secret id is COMPARED against the
 * configured one rather than trusted (`readEvent`).
 */

/** The role names this function will ever `ALTER`. `reconcile_` + lowercase + `_`. */
export const ROLE_NAME_PATTERN = /^reconcile_[a-z_]{1,40}$/

/**
 * What a PostgreSQL SCRAM verifier may contain. Base64, digits, `$` and `:` —
 * NO QUOTE, so interpolating one inside `'…'` cannot terminate the literal.
 */
export const VERIFIER_PATTERN =
  /^SCRAM-SHA-256\$\d{4,7}:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/

/** Printable ASCII, no space — the alphabet Secrets Manager generates from. */
export const PASSWORD_PATTERN = /^[!-~]{32,128}$/

/** A refusal: the rotation stops and the function throws, which is what the alarm counts. */
export class RotationRefusal extends Error {
  /** @param {string} reason */
  constructor(reason, detail = '') {
    super(detail === '' ? reason : `${reason}: ${detail}`)
    this.name = 'RotationRefusal'
    this.reason = reason
  }
}

const STEPS = new Set(['createSecret', 'setSecret', 'testSecret', 'finishSecret'])

/**
 * @param {Record<string, string | undefined>} env
 */
export function readConfig(env) {
  const need = (name) => {
    const v = env[name]
    if (v === undefined || v === '') throw new RotationRefusal('config_missing', name)
    return v
  }
  const roleName = need('ROTATION_ROLE_NAME')
  if (!ROLE_NAME_PATTERN.test(roleName)) throw new RotationRefusal('role_name_refused', roleName)
  const holders = JSON.parse(need('ROTATION_HOLDER_SERVICES'))
  if (
    holders === null ||
    typeof holders !== 'object' ||
    typeof holders.cluster !== 'string' ||
    !Array.isArray(holders.services) ||
    !holders.services.every((s) => typeof s === 'string')
  ) {
    throw new RotationRefusal('holder_services_malformed')
  }
  const length = Number(need('ROTATION_PASSWORD_LENGTH'))
  if (!Number.isInteger(length) || length < 32 || length > 128) {
    throw new RotationRefusal('password_length_refused')
  }
  return {
    secretArn: need('ROTATION_SECRET_ARN'),
    masterSecretArn: need('ROTATION_MASTER_SECRET_ARN'),
    roleName,
    databaseName: need('ROTATION_DATABASE_NAME'),
    excludeCharacters: need('ROTATION_EXCLUDE_CHARACTERS'),
    passwordLength: length,
    holders: { cluster: holders.cluster, services: holders.services },
  }
}

/**
 * @param {unknown} event
 * @param {{secretArn: string}} config
 */
export function readEvent(event, config) {
  if (event === null || typeof event !== 'object') throw new RotationRefusal('event_malformed')
  const { Step, SecretId, ClientRequestToken } = /** @type {Record<string, unknown>} */ (event)
  if (typeof Step !== 'string' || !STEPS.has(Step)) throw new RotationRefusal('step_unknown')
  if (typeof ClientRequestToken !== 'string' || ClientRequestToken === '') {
    throw new RotationRefusal('token_missing')
  }
  /* 🛑 THE SECRET IS COMPARED, NEVER TRUSTED. Secrets Manager's invoke
   * permission is a service principal, and this function holds the cluster
   * ADMIN's password: it must act on the one secret it was built for, whatever
   * an invocation names. */
  if (SecretId !== config.secretArn) throw new RotationRefusal('secret_not_mine')
  return { step: Step, secretId: SecretId, token: ClientRequestToken }
}
