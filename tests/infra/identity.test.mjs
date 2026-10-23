/**
 * G302's BROKER — the pool that refuses, the client that offers no native flow,
 * and the four names that must not carry a tenant.
 *
 * 🛑 HALF OF THIS FILE READS A FIXTURE RATHER THAN THE REAL APP, AND THAT IS
 * THE POINT — `tests/infra/storage.test.mjs` says the same thing for the same
 * reason. `FEDERATED_CONNECTIONS` is empty because there is no customer and
 * because `tenant.identity_connection` has no column to record one in, so the
 * deployed `Identity` stack contains a pool, a domain, one app client and ZERO
 * providers. Asserting against that alone would witness nothing about the
 * provider factory or about the supported-provider list — `docs/HANDOFF.md`
 * §5.6 — so the real app is asserted for what it really deploys and
 * `infra/test-fixtures/identity-connections.ts` for what the factory produces
 * when a connection arrives.
 *
 * ⚠️ EVERY EXPECTED STRING IS TYPED INTO THIS FILE, none imported from
 * `infra/lib/`. Comparing a stack to the constant the stack read proves only
 * that a variable equals itself.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-identity-staging'
const POOL = 'AWS::Cognito::UserPool'
const CLIENT = 'AWS::Cognito::UserPoolClient'
const DOMAIN = 'AWS::Cognito::UserPoolDomain'
const PROVIDER = 'AWS::Cognito::UserPoolIdentityProvider'

/** The account the whole app deploys into (G279). Typed, never imported. */
const ACCOUNT = '000000000000'

const realStack = () => {
  const template = synthesisedTemplates()[STACK]
  assert.ok(template, `${STACK} is not in the synthesised app at all`)
  return template
}

let fixtureTemplate
const withConnections = () => {
  if (fixtureTemplate === undefined) {
    const run = runInfraScript('test-fixtures/identity-connections.ts')
    assert.equal(run.status, 0, `the connections fixture must synthesise; stderr=${run.stderr}`)
    fixtureTemplate = JSON.parse(run.stdout)
  }
  return fixtureTemplate
}

const only = (template, type) => {
  const found = resourcesOfType(template, type)
  assert.equal(found.length, 1, `expected exactly one ${type}, found ${found.length}`)
  return found[0][1].Properties ?? {}
}

// ---------------------------------------------- 1. one pool, and only one

test('test_exactly_one_user_pool_exists_in_the_whole_app_because_a_pool_per_tenant_enumerates_tenants', () => {
  /* 🛑 THE PROPERTY IS NOT "one per stack". `cognito-idp:ListUserPools` takes
   * NO RESOURCE — it is account-wide, like `kms:ListAliases` — so a second pool
   * that happened to carry a tenant name would publish a customer to every
   * principal holding one permission, and `RequiredTagsAspect` cannot see it
   * because a pool name is not a tag. The count is over the WHOLE APP. */
  const pools = Object.entries(synthesisedTemplates()).flatMap(([name, template]) =>
    resourcesOfType(template, POOL).map(([logicalId]) => `${name}/${logicalId}`),
  )
  assert.deepEqual(
    pools,
    [`${STACK}/PoolD3F588B8`],
    'G302: ONE pool for the fleet. A second one is either a pool per tenant ' +
      `arriving unruled or a pool nobody argued for: ${JSON.stringify(pools)}`,
  )
})

test('test_no_cognito_resource_anywhere_carries_a_tenant_name', () => {
  /* The four names a reader of AWS metadata can see: the pool, the domain
   * prefix, the app client and any provider. None may name a customer. This
   * scans the rendered strings rather than the constants that built them. */
  const template = realStack()
  const names = [
    only(template, POOL).UserPoolName,
    only(template, DOMAIN).Domain,
    only(template, CLIENT).ClientName,
    ...resourcesOfType(template, PROVIDER).map(([, r]) => r.Properties?.ProviderName),
  ]
  for (const name of names) {
    assert.equal(typeof name, 'string', `a Cognito name did not render as a string: ${name}`)
    assert.doesNotMatch(
      name,
      /ten[_-]/,
      `'${name}' looks like it names a tenant. A Cognito name is readable through an ` +
        'account-wide or pool-wide list call and, for a provider, is echoed in the ' +
        'hosted UI query string. G260 refuses this disclosure at a tag; it is the ' +
        'same disclosure here.',
    )
  }
})

test('test_the_globally_unique_domain_prefix_carries_the_account_so_it_cannot_collide_with_a_stranger', () => {
  /* An S3 bucket name and a Cognito domain prefix are the only two GLOBAL
   * namespaces this app writes into, and both fail the same way: at deploy,
   * against a name some other AWS customer already holds. `objectBucketName()`
   * answers it with account plus region; this answers it with account plus
   * environment, because a Cognito domain is already region-scoped in its
   * suffix. */
  const domain = only(realStack(), DOMAIN).Domain
  assert.ok(
    domain.includes(ACCOUNT),
    `the domain prefix '${domain}' does not carry the account id, so it is a name ` +
      'any AWS customer on earth may already hold',
  )
  assert.ok(domain.length <= 63, `Cognito caps a domain prefix at 63 characters: '${domain}'`)
  assert.match(
    domain,
    /^[a-z][a-z0-9-]*[a-z0-9]$/,
    `Cognito accepts lowercase letters, digits and hyphens only: '${domain}'`,
  )
  for (const forbidden of ['aws', 'amazon', 'cognito']) {
    assert.equal(
      domain.includes(forbidden),
      false,
      `Cognito refuses a prefix containing '${forbidden}': '${domain}'`,
    )
  }
})

// ------------------------------------- 2. G223: no second factor in v1

test('test_the_pool_configures_no_mfa_because_g223_gives_the_second_factor_to_the_customer_idp', () => {
  const pool = only(realStack(), POOL)
  assert.equal(
    pool.MfaConfiguration,
    'OFF',
    'G223: "no second factor in v1; federation owns it." A broker that demanded ' +
      'one would be claiming authority over a directory it does not own, and ' +
      'Session.secondFactorAt is a field-level drop under the same ruling.',
  )
  assert.equal(pool.EnabledMfas, undefined, 'an MFA mechanism is configured on a pool with MFA OFF')
})

// ------------------------- 3. FENCE 1: nobody may create a native user

test('test_self_registration_is_off_so_no_unauthenticated_caller_can_write_into_the_directory', () => {
  const pool = only(realStack(), POOL)
  assert.equal(
    pool.AdminCreateUserConfig?.AllowAdminCreateUserOnly,
    true,
    'G302: a native Cognito user has no owning directory, so orgClass would have ' +
      'nothing to derive from. Self-registration would let an unauthenticated ' +
      'caller create exactly that user.',
  )
})

test('test_there_is_no_self_service_account_recovery_because_it_is_the_one_unauthenticated_path_in', () => {
  const pool = only(realStack(), POOL)
  const mechanisms = pool.AccountRecoverySetting?.RecoveryMechanisms ?? []
  assert.deepEqual(
    mechanisms.map((m) => m.Name),
    ['admin_only'],
    'a "forgot password" flow mints a credential over email for a native user. ' +
      'There are no passwords here anybody is meant to use, so recovery would be ' +
      'the one unauthenticated path into a directory three fences keep people out of.',
  )
})

// ------------- 4. FENCE 2: the client offers no way to use a native user

test('test_the_only_explicit_auth_flow_is_refresh_token_exchange', () => {
  /* 🛑 THE ASSERTION IS ON THE RENDERED LIST AND NOT ON ITS ABSENCE, because
   * an ABSENT ExplicitAuthFlows is Cognito's legacy default — USER_SRP_AUTH,
   * CUSTOM_AUTH, REFRESH_TOKEN_AUTH — which is native sign-in wearing a
   * missing property. `aws-cdk-lib` renders nothing for `authFlows: {}`, so
   * the stack passes one explicit `false` to make the list exist. */
  for (const [label, template] of [
    ['the real app', realStack()],
    ['the fixture', withConnections()],
  ]) {
    const flows = only(template, CLIENT).ExplicitAuthFlows
    assert.deepEqual(
      flows,
      ['ALLOW_REFRESH_TOKEN_AUTH'],
      `${label}: the app client must offer refresh-token exchange and nothing else. ` +
        'USER_PASSWORD_AUTH, USER_SRP_AUTH, ADMIN_USER_PASSWORD_AUTH and USER_AUTH ' +
        'each let a caller present a password to the pool.',
    )
  }
})

test('test_supported_identity_providers_is_rendered_and_never_contains_cognito', () => {
  /* 🛑 THE TRAP THIS TEST EXISTS FOR. `aws-cdk-lib` renders an EMPTY
   * supportedIdentityProviders as an OMITTED property, and an omitted
   * SupportedIdentityProviders is Cognito's default, which is COGNITO — the
   * native directory. The array meaning "no native sign-in" would have meant
   * "native sign-in only", in a template that looks correct. The stack writes
   * the value onto the L1 resource unconditionally; this is what notices if
   * somebody deletes that line as redundant.
   *
   * ⚠️ AND THE ASSERTION RUNS OVER BOTH TEMPLATES ON PURPOSE. Over the real
   * app alone, "does not contain COGNITO" is true of an empty list whatever the
   * code does — it would pass vacuously. The fixture is what makes it bite. */
  const real = only(realStack(), CLIENT)
  assert.ok(
    Array.isArray(real.SupportedIdentityProviders),
    'SupportedIdentityProviders is not rendered at all, so Cognito will default it ' +
      'to COGNITO and the pool will offer a native sign-in form',
  )
  assert.deepEqual(
    real.SupportedIdentityProviders,
    [],
    'the real app declares no federated connection, so the list must be empty AND present',
  )

  const fixture = only(withConnections(), CLIENT)
  assert.deepEqual(
    fixture.SupportedIdentityProviders,
    ['c-0f3a9c71b28d4e60', 'c-a91d0c44e7b2f358'],
    'the factory must put exactly the declared connections on the client, by opaque handle',
  )
  assert.equal(
    fixture.SupportedIdentityProviders.includes('COGNITO'),
    false,
    'COGNITO in this list is the native directory offered on the hosted UI',
  )
})

test('test_the_client_holds_no_secret_and_refuses_the_implicit_grant', () => {
  const client = only(realStack(), CLIENT)
  assert.notEqual(
    client.GenerateSecret,
    true,
    'G263: a client secret shipped to a browser is a static credential published ' +
      'to every viewer',
  )
  assert.deepEqual(
    client.AllowedOAuthFlows,
    ['code'],
    'the implicit grant returns tokens in the URL fragment, where they land in ' +
      'browser history and in Referer headers',
  )
  assert.equal(client.AllowedOAuthFlowsUserPoolClient, true)
})

test('test_the_client_does_not_request_the_scope_that_lets_a_token_edit_its_own_directory', () => {
  const scopes = only(realStack(), CLIENT).AllowedOAuthScopes
  assert.equal(
    scopes.includes('aws.cognito.signin.user.admin'),
    false,
    'that scope lets the ACCESS TOKEN call Cognito user APIs as the signed-in ' +
      'person, including writing their own attributes. A token that can edit the ' +
      'directory it was issued against can edit the evidence. CDK adds it by ' +
      'default when scopes are omitted.',
  )
  assert.deepEqual([...scopes].sort(), ['email', 'openid', 'profile'])
})

test('test_the_cognito_token_expires_in_the_length_of_a_redirect_rather_than_a_session', () => {
  /* `model/access.ts` refuses the JWT shape outright — "A REFERENCE, NOT A
   * BEARER TOKEN" — so the credential this product carries is a Session row
   * reached by a digested handle. The Cognito token is consumed once, at the
   * callback, and never presented again. */
  const client = only(realStack(), CLIENT)
  assert.equal(client.AccessTokenValidity, 5)
  assert.equal(client.IdTokenValidity, 5)
  assert.equal(client.TokenValidityUnits?.AccessToken, 'minutes')
  assert.equal(client.TokenValidityUnits?.IdToken, 'minutes')
  assert.equal(client.EnableTokenRevocation, true)
})

test('test_prevent_user_existence_errors_is_enabled_for_the_reason_the_session_contract_states', () => {
  assert.equal(
    only(realStack(), CLIENT).PreventUserExistenceErrors,
    'ENABLED',
    'session.openapi.yaml holds the same line for resolveHomeRealm: "returning 404 ' +
      'for an unknown address is the natural thing to write and it is a ' +
      'user-existence oracle." Two layers, one property.',
  )
})

// ------------------------------- 5. the callback URLs, and what they are not

test('test_the_callback_urls_are_ONE_shared_regional_return_url_plus_the_two_flat_consoles', () => {
  /* ✅ G2549, THE OWNER'S RULING OF 2 Oct 2026 (applied by G2765): *"One
   * shared callback host: all sign-ins return to one fixed callback which then
   * 303s to the tenant host via resolveServingHost."* THIS TEST WAS
   * `test_the_callback_urls_are_the_two_flat_console_hosts_plus_tenant_hosts_on_the_regional_grammar`
   * AND ASSERTED `ten-acme.us-west-2.reconcileai.app/signin/callback` IN THE
   * LIST — G2548's callback-per-tenant shape, whose cost (one exact entry per
   * tenant, a customer list readable through DescribeUserPoolClient, Cognito's
   * 100-URL ceiling) G2549 put to the owner. The owner answered it.
   *
   * WHAT IS ASSERTED NOW: NO TENANT HOST IS IN THE LIST AT ALL — the customer
   * list is no longer published through this API — the one shared URL is
   * REGIONAL (G297's residency half: a regional fact wears a region), it is on
   * the `auth` label RESERVED_LABEL_CLAIMED_BY held for federation, and the
   * consoles stay flat. Witnessed RED by putting `ten-acme` back. */
  const urls = [...only(realStack(), CLIENT).CallbackURLs].sort()
  assert.deepEqual(urls, [
    'https://auth.us-west-2.reconcileai.app/session/signin/return',
    'https://console.reconcileai.app/signin/callback',
    'https://partners.reconcileai.app/signin/callback',
  ])
  for (const url of urls) {
    assert.equal(url.startsWith('https://'), true, `'${url}' is not https`)
    const host = new URL(url).hostname
    assert.equal(
      /^ten-/.test(host),
      false,
      `'${url}' names a TENANT host - G2549 makes the list tenant-independent`,
    )
  }
  assert.equal(new URL(urls[0]).hostname.split('.').length, 4, 'the shared return host is regional')
})

// -------------------------------------- 6. the provider factory, witnessed

test('test_the_real_app_registers_no_identity_provider_at_all_so_nobody_can_sign_in', () => {
  assert.deepEqual(
    resourcesOfType(realStack(), PROVIDER).map(([id]) => id),
    [],
    'G302: tenant.identity_connection has no column for a provider name, so a ' +
      'door minted here would have no row behind it and every person walking ' +
      'through it would be refused at owner_unresolvable. Zero is the honest state.',
  )
})

test('test_the_factory_renders_a_saml_provider_per_connection_with_no_attribute_mapping', () => {
  const providers = resourcesOfType(withConnections(), PROVIDER)
  assert.equal(providers.length, 2, 'two connections must render two providers, not one merged')
  for (const [, resource] of providers) {
    const p = resource.Properties ?? {}
    assert.equal(p.ProviderType, 'SAML')
    assert.match(p.ProviderName, /^c-[0-9a-f]{16}$/, 'a provider name is an opaque handle')
    assert.ok(p.ProviderName.length >= 3 && p.ProviderName.length <= 32)
    assert.equal(
      p.AttributeMapping,
      undefined,
      'which assertion attribute becomes which Cognito attribute decides what this ' +
        'product STORES about a customer staff member. db/migrations/0009 narrows ' +
        'PrincipalContext to { userId, status } for that reason; mapping here would ' +
        'decide it by side effect.',
    )
    assert.equal(
      p.ProviderDetails?.IDPInit,
      undefined,
      'IdP-initiated SAML accepts an UNSOLICITED assertion, with no RelayState ' +
        'bound to a session the browser started',
    )
    assert.ok(
      p.ProviderDetails?.MetadataURL,
      'a SAML connection must point at a metadata URL, which is what makes it need ' +
        'no stored secret (G263)',
    )
    assert.equal(
      p.ProviderDetails?.client_secret,
      undefined,
      'G263: no stored client secret anywhere in this app',
    )
  }
})

// ------------------------------------------ 7. the two refusals, witnessed RED

test('test_a_connection_handle_that_names_a_tenant_fails_synth', () => {
  /* The control on the control. `assertOpaqueProviderHandle()` that never
   * threw would be a paragraph, and `tests/infra/storage.test.mjs` makes the
   * same argument for the KMS alias at a different API. */
  const run = runInfraScript('test-fixtures/identity-named-tenant.ts')
  assert.notEqual(
    run.status,
    0,
    'a provider handle of "ten_acme" synthesised. A Cognito provider name is ' +
      'readable through ListIdentityProviders AND echoed in the hosted UI query ' +
      `string. stdout=${run.stdout}`,
  )
  assert.match(`${run.stderr}${run.stdout}`, /opaque connection handle/)
  assert.doesNotMatch(run.stdout, /SYNTH OK/)
})

test('test_an_oidc_connection_fails_synth_because_cognito_stores_the_secret_value', () => {
  const run = runInfraScript('test-fixtures/identity-oidc-secret.ts')
  assert.notEqual(
    run.status,
    0,
    'an OIDC connection synthesised. Cognito stores the client secret VALUE, a ' +
      'dynamic reference resolves once at deploy, and a rotation that never reaches ' +
      `the pool is recorded as working. stdout=${run.stdout}`,
  )
  assert.match(`${run.stderr}${run.stdout}`, /rotation that does not rotate/)
  assert.doesNotMatch(run.stdout, /SYNTH OK/)
})

test('test_the_two_fixtures_differ_from_the_green_one_in_exactly_one_field_each', () => {
  /* 🛑 WITHOUT THIS, EITHER RED ABOVE COULD BE A TYPO. A fixture that failed
   * to synthesise for an unrelated reason would satisfy both assertions and
   * witness nothing — `docs/HANDOFF.md` §5.6 arriving inside the tests written
   * to answer it. The green fixture is what proves the surrounding stack
   * synthesises fine and that the ONE changed field is what refuses. */
  const green = runInfraScript('test-fixtures/identity-connections.ts')
  assert.equal(green.status, 0, `the green fixture must synthesise: ${green.stderr}`)
})

// ------------------------------------------------------ 8. G260's six tags

test('test_the_user_pool_carries_the_six_tags_and_is_plane_edge', () => {
  /* `AWS::Cognito::UserPool` renders its tags under `UserPoolTags`, not `Tags`
   * — so the Aspect visits it only because `CfnUserPool` declares a TagManager,
   * and this is what notices if a future CDK version stops. */
  const tags = only(realStack(), POOL).UserPoolTags ?? {}
  assert.deepEqual(Object.keys(tags).sort(), [
    'CostCentre',
    'Environment',
    'ManagedBy',
    'Owner',
    'Plane',
    'Project',
  ])
  assert.equal(tags.Project, 'reconcile')
  assert.equal(tags.Environment, 'staging')
  assert.equal(
    tags.Plane,
    'edge',
    'one pool serves the consoles AND every tenant and has a route to neither ' +
      'cluster, so "data" and "control" would both be false in the one field G260 ' +
      'says invariant 3 is audited from',
  )
  for (const forbidden of ['TenantId', 'Tenant', 'TenantRef']) {
    assert.equal(Object.hasOwn(tags, forbidden), false, `G260 forbids a ${forbidden} tag`)
  }
})

// ------------------------------- 9. the pool survives what the domain must not

test('test_the_pool_is_retained_and_the_globally_unique_domain_is_not', () => {
  /* 🛑 THE TWO POLICIES ARE OPPOSITE ON PURPOSE. A user pool holds the LINK
   * between a federated identity and a Cognito user and there is no restore; a
   * pool name is not unique, so a retained pool blocks no future deploy. A
   * domain holds nothing and its prefix is unique across ALL of AWS — so a
   * retained one after a rolled-back stack is trap 3 of deploy-handoff.md §3
   * ("the next deploy fails with already exists") in a namespace we could not
   * clear by deleting anything of ours. */
  const template = realStack()
  const [, pool] = resourcesOfType(template, POOL)[0]
  const [, domain] = resourcesOfType(template, DOMAIN)[0]
  assert.equal(pool.DeletionPolicy, 'Retain')
  assert.equal(pool.UpdateReplacePolicy, 'Retain')
  assert.equal(pool.Properties?.DeletionProtection, 'ACTIVE')
  assert.equal(domain.DeletionPolicy, 'Delete')
})
