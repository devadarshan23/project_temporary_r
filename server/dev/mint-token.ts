/**
 * THE SCRIPT RULING 2 ASKS FOR — "a script mints a short-lived token".
 *
 *     node server/dev/mint-token.ts ten_acme
 *     node server/dev/mint-token.ts ten_globex --ttl 900
 *
 * It prints the token on stdout and everything else on stderr, so
 * `TOKEN=$(node server/dev/mint-token.ts ten_acme)` works and the banner still
 * reaches a human.
 *
 * ⚠️ MINTING IS NOT GATED BY THE FLAG AND ACCEPTING IS. This script will happily
 * mint against a plane that will refuse the result, and that asymmetry is the
 * property `tests/http/data-plane-http.test.ts` assertion 5 pins: the assertion
 * that matters is that a PERFECTLY VALID, CORRECTLY SIGNED token is refused by a
 * plane started without `RECONCILE_LOCAL_TEST_AUTH=1`. A minter that checked the
 * flag could not produce the token that test needs.
 */

import { DEFAULT_TTL_SECONDS, mintTestToken } from './test-token.ts'

function usage(message: string): never {
  process.stderr.write(
    `${message}\n\n` +
      'usage: node server/dev/mint-token.ts <tenantId> [--ttl <seconds>]\n' +
      `       tenantId is a slug stored verbatim (G97) — e.g. ten_acme\n` +
      `       --ttl defaults to ${DEFAULT_TTL_SECONDS} seconds\n`,
  )
  process.exit(2)
}

const args = process.argv.slice(2)
const tenantId = args[0]
if (tenantId === undefined || tenantId.startsWith('-')) usage('a tenantId is required')

let ttlSeconds = DEFAULT_TTL_SECONDS
const ttlAt = args.indexOf('--ttl')
if (ttlAt !== -1) {
  const raw = args[ttlAt + 1]
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) usage('--ttl needs a positive whole number of seconds')
  ttlSeconds = parsed
}

const token = mintTestToken({ tenantId, ttlSeconds })

process.stderr.write(
  [
    '',
    `minted for ${tenantId}, valid ${ttlSeconds}s.`,
    '',
    'The plane must have been STARTED with RECONCILE_LOCAL_TEST_AUTH=1 or it will',
    'refuse this token with 401 session_invalid — the flag is read once, at boot.',
    '',
    '🛑 G386: on a plane WITHOUT that flag there is no `X-Session` reader in the',
    '   process at all, so neither line below reaches anything. The production',
    '   channel is the `__Host-reconcile_session` cookie, and this token has no',
    '   session row behind it to put in one.',
    '',
    `  curl -sS -H "X-Session: ${token}" http://127.0.0.1:9080/v1/runs`,
    '',
  ].join('\n'),
)
process.stdout.write(`${token}\n`)
