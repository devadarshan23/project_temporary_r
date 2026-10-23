/**
 * G4471 — EVERY ROTATED ROLE SECRET ROTATES THE ROLE ITS PLANE ACTUALLY
 * CONNECTS AS. V-3, closing G4463.
 *
 * 🛑 THE DEFECT THIS EXISTS FOR WAS LIVE ON STAGING AND EVERY EXISTING CONTROL
 * WAS GREEN. `infra/lib/data-stack.ts` wired the `ControlApp` secret — on the
 * CONTROL cluster — to `reconcile_app`, the DATA plane's role, while the control
 * plane connects as `reconcile_control_app` (`CONTROL_APP_ROLE` in
 * `server/control-plane/config.ts`). The weekly rotation refused every attempt
 * with `role_absent_or_nologin: reconcile_app`. `tests/infra/role-secret-rotation.test.mjs`
 * §3 asserted the synthesised wiring against a TYPED table — and the table had
 * the same wrong name typed into it, so the test pinned the defect.
 *
 * ✅ SO THE EXPECTED ROLE HERE IS NOT TYPED. It is read from the constant each
 * plane's serving or migrate code actually uses to log in: `ROLES` in
 * `db/env.ts` for the data cluster, `CONTROL_APP_ROLE` for the control
 * cluster. Those are the other side of the boundary `infra/` cannot import
 * across (G259 — `infra/` has its own manifest), so `infra/` SPELLS the name
 * and this test is what makes the spelling a mirror rather than a guess.
 * The only typed thing is the join — which secret belongs to which constant —
 * and that is the claim, not a value.
 *
 * WITNESSED RED, TWICE, BEFORE THE FIX LANDED:
 *
 *   against `origin/main` (1f003038) — the second test:
 *     AssertionError [ERR_ASSERTION]: reconcile-staging-controlapp: rotates
 *     "reconcile_app", the plane connects as "reconcile_control_app"
 *
 *   against a HALF-fix (the rotation's role renamed, the secret's username
 *   left) — the third test, which the old wiring passed because it was
 *   consistently wrong:
 *     AssertionError [ERR_ASSERTION]: reconcile-staging-controlapp: the
 *     secret's username "reconcile_app" is not the rotated role
 *     "reconcile_control_app" — rotation would refuse
 *     secret_username_is_not_the_role
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'
import { ROLES } from '../../db/env.ts'
import { CONTROL_APP_ROLE } from '../../server/control-plane/config.ts'

/** The join: which secret holds which plane's role. Values are DERIVED. */
const ROLE_THE_PLANE_CONNECTS_AS = {
  'reconcile-staging-datamigrator': ROLES.migrator,
  'reconcile-staging-dataapp': ROLES.app,
  'reconcile-staging-dataengine': ROLES.engine,
  'reconcile-staging-controlapp': CONTROL_APP_ROLE,
}

await ensureDeps()
const data = synthesisedTemplates()['reconcile-data-staging']

const rotations = resourcesOfType(data, 'AWS::SecretsManager::RotationSchedule').filter(
  ([, r]) => r.Properties.RotationLambdaARN !== undefined,
)

const wiring = rotations.map(([, rotation]) => {
  const secretId = rotation.Properties.SecretId.Ref
  const secret = data.Resources[secretId]
  const fnId = rotation.Properties.RotationLambdaARN['Fn::GetAtt'][0]
  const env = data.Resources[fnId].Properties.Environment.Variables
  return {
    name: secret.Properties.Name,
    rotatedRole: env.ROTATION_ROLE_NAME,
    secretUsername: JSON.parse(secret.Properties.GenerateSecretString.SecretStringTemplate).username,
  }
})

test('test_the_rotated_secrets_are_exactly_the_joined_set_and_it_is_not_empty', () => {
  /* Anti-vacuity: an empty `rotations` would pass every per-secret loop below. */
  assert.ok(wiring.length > 0, 'no custom role-secret rotation found in the Data template')
  assert.deepEqual(
    wiring.map((w) => w.name).sort(),
    Object.keys(ROLE_THE_PLANE_CONNECTS_AS).sort(),
    'a rotated secret with no joined plane role, or a joined secret that does not rotate',
  )
})

test('test_every_rotation_rotates_the_role_its_plane_connects_as', () => {
  for (const w of wiring) {
    const expected = ROLE_THE_PLANE_CONNECTS_AS[w.name]
    assert.equal(
      w.rotatedRole,
      expected,
      `${w.name}: rotates "${w.rotatedRole}", the plane connects as "${expected}"`,
    )
  }
})

test('test_every_role_secrets_username_is_the_role_it_rotates', () => {
  /* The rotation refuses `secret_username_is_not_the_role` when the stored
   * username disagrees with ROTATION_ROLE_NAME (rotation.mjs), so fixing the
   * role name without the username trades one refusal for another. */
  for (const w of wiring) {
    assert.equal(
      w.secretUsername,
      w.rotatedRole,
      `${w.name}: the secret's username "${w.secretUsername}" is not the rotated role ` +
        `"${w.rotatedRole}" — rotation would refuse secret_username_is_not_the_role`,
    )
  }
})
