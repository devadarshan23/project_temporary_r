/**
 * `Identity` — G302, 19 Sep 2026. **THE BROKER.**
 *
 * ┌─ 🛑 WHAT THIS STACK IS FOR, IN THE RULING'S OWN WORDS ─────────────────────┐
 * │ *"COGNITO IS A BROKER FOR EXTERNAL IdPs, AND EACH CONNECTION BECOMES AN    │
 * │ `identity_connection` ROW."* The argument is that it lands where           │
 * │ `orgClass` already comes from: `orgFor(connection.owner)` derives          │
 * │ organisation FROM WHICH DIRECTORY AUTHENTICATED, so *"a federated          │
 * │ connection is not a new concept bolted on — it is the producer the model   │
 * │ has been waiting for."*                                                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE FIRST THING TO READ: **THIS STACK CANNOT MAKE NATIVE USERS
 *    IMPOSSIBLE, AND SAYING OTHERWISE WOULD BE THE WORST SENTENCE IN THIS
 *    FILE.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A Cognito user pool **is** a user directory. There is no configuration that
 * removes its native directory, no flag that makes `AdminCreateUser` return an
 * error, and an account administrator can always write a user into it. G302
 * asks the right question — *"If your design makes native users possible, say
 * so and argue it; do not let them in by default"* — and the honest answer is
 * that they are possible at the API and **unreachable at three successive
 * fences, only one of which is in this file.** They are stated in the order a
 * would-be native user meets them:
 *
 *  1. **NOBODY MAY CREATE ONE WITHOUT AN ADMIN ACTION.** `selfSignUpEnabled` is
 *     `false`, which renders `AdminCreateUserConfig.AllowAdminCreateUserOnly`,
 *     and `accountRecovery` is `NONE` — there is no self-registration and no
 *     self-service password reset, so no unauthenticated caller can put a row
 *     in this directory or take one over.
 *  2. **THE ONE APP CLIENT OFFERS NO WAY TO USE ONE.** `ExplicitAuthFlows`
 *     carries `ALLOW_REFRESH_TOKEN_AUTH` **and nothing else** — no
 *     `USER_PASSWORD_AUTH`, no `USER_SRP_AUTH`, no `ADMIN_USER_PASSWORD_AUTH`,
 *     no `USER_AUTH` — so `InitiateAuth` and `AdminInitiateAuth` refuse a
 *     password at the pool, whatever password the directory holds. And
 *     `SupportedIdentityProviders` is the DERIVED federated list, from which
 *     `COGNITO` is absent, so the hosted UI offers no native form to submit.
 *  3. 🛑 **AND THE LOAD-BEARING FENCE IS NOT HERE AT ALL, WHICH IS WHY THIS
 *     PARAGRAPH EXISTS RATHER THAN A CLAIM OF COMPLETENESS.** Even a native
 *     user holding a valid Cognito token reaches nothing: there is no
 *     `tenant.identity_connection` row for the native directory, so
 *     `server/data-plane/identity.ts` cannot assemble an `owner`, `orgFor()` is
 *     never called, and the refusal is `owner_unresolvable` — a 401 by name.
 *     **G289 priced the alternative at five deleted controls and G302 quotes
 *     the price.** The product is safe because `orgClass` has exactly one
 *     producer, not because a pool was configured well.
 *
 * **Fences 1 and 2 are this file's and are witnessed against AWS. Fence 3 is
 * `db/` and `server/`, is already built, and is the one that would still hold
 * if every line below were wrong.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NOTHING HERE CREATES AN IDENTITY PROVIDER, AND THE EMPTINESS IS THE
 *    HONEST STATE RATHER THAN AN UNFINISHED SLICE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `FEDERATED_CONNECTIONS` is empty for the same reason `TENANT_KEY_HANDLES` is:
 * there is no customer. It is also empty for a reason `Storage` did not have —
 * **there is nowhere to record a connection.** `db/migrations/0009_identity_
 * substrate.sql` gives `tenant.identity_connection` seven columns and none of
 * them can hold a Cognito provider name, so a provider minted today would be a
 * door with no row behind it and every person walking through it would be
 * refused at `owner_unresolvable`. G299 anticipated it in as many words:
 * Cognito *"is FREE TO FORCE A SECOND MIGRATION"*. **That migration is named in
 * this slice's report and is not written here** — `db/` is another agent's.
 *
 * So the deployed stack is a pool, a domain and one app client, with **zero
 * providers and therefore zero people who can sign in**. That is not a stub. It
 * is the strongest refusal this layer can express, and it is the one the report
 * witnesses from AWS rather than from this template.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ G223 IS UNCHANGED AND BINDS: *"no second factor in v1; federation owns
 *    it."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `mfa` is `Mfa.OFF` below and it is an **assertion**, not an absence of
 * thought. `Session.secondFactorAt` is a field-level `@dropped-for-v1` under
 * G223; the second factor is the customer IdP's to enforce on its own users,
 * and a broker that demanded one would be claiming authority over a directory
 * it does not own. Turning it on here would also be inert against the only
 * users this pool will ever serve, because a federated sign-in never presents a
 * credential to Cognito at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ G263 — NO STATIC KEYS. WHAT THAT MEANS FOR AN IdP, AND WHERE IT BITES.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * · **The app client has NO secret.** `generateSecret` is `false`: it is a
 *   public browser client, and a client secret shipped to a browser is a static
 *   credential published to every viewer. The authorization-code flow is used
 *   with PKCE, which is the browser's half and is named as a frontend gap
 *   below rather than claimed here.
 * · **A SAML connection needs no secret at all.** Cognito fetches the IdP's
 *   metadata document over HTTPS and trusts a signing certificate inside it.
 *   That is why this slice admits SAML and refuses OIDC — see
 *   `assertNoStoredClientSecret()`, which carries the whole argument.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE TRAP THIS FILE FOUND, BECAUSE THE NEXT READER WILL WALK INTO IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **`supportedIdentityProviders: []` DOES NOT MEAN "NO PROVIDERS". IT MEANS
 * "LET CLOUDFORMATION DECIDE", AND CLOUDFORMATION DECIDES `COGNITO`.**
 * `aws-cdk-lib`'s `UserPoolClient` maps the prop through
 * `configureIdentityProviders()`, whose last line is `if (providers.length !==
 * 0) return ...` — so an EMPTY array is rendered as **an omitted property**,
 * and an omitted `SupportedIdentityProviders` is Cognito's own default, which
 * is the native directory. An author who wrote the empty array meaning *no
 * native sign-in* would have written *native sign-in only*, and the template
 * would look right.
 *
 * The repair is one line and it is `addPropertyOverride` below: the value is
 * written into the L1 resource unconditionally, so the empty list survives to
 * CloudFormation as an empty list. `tests/infra/identity.test.mjs` asserts the
 * rendered property exists and does not contain `COGNITO`, over BOTH the real
 * template and the fixture, because an assertion over the one with no providers
 * would pass vacuously.
 *
 * 🛑 **AND A SYNTHESISED PROPERTY IS NOT A PROPERTY THE SERVICE ACCEPTED —
 * TRAP 10, WHICH COST G287 A KEY POLICY THAT PASSED `tsc`, SYNTH, THE GATE AND
 * A CLEAN DEPLOY AND WAS THEN REFUSED BY KMS. SO IT WAS READ BACK FROM AWS,
 * AND WHAT CAME BACK IS NOT WHAT THE TEMPLATE SAYS.** Measured against the
 * deployed pool, 19 Sep 2026:
 *
 *     aws cognito-idp describe-user-pool-client --user-pool-id us-west-2_bWwWkb0iD
 *       --client-id 6ig2p5gam6vhbjdugk9vo5e0vu
 *     => the response carries NO `SupportedIdentityProviders` KEY AT ALL
 *
 * **Cognito stored the empty list as an absence — and the absence is NOT the
 * native default it would have been had CDK omitted the property.** Stored
 * configuration is not behaviour either, so the hosted UI was asked directly:
 *
 *     GET https://<domain>/oauth2/authorize?client_id=...&response_type=code
 *       => 302 to /login
 *     GET https://<domain>/login?client_id=...
 *       => 302 to /error, content-length 0, error page reads
 *          "An error was encountered with the requested page."
 *
 * **There is no sign-in page. Not a native form, not a federated button,
 * nothing.** The front door refuses to open for anybody, which is the correct
 * behaviour for a broker with no doors and is a stronger statement than any
 * property this template could carry.
 *
 * ⚠️ **WHAT THAT MEASUREMENT DOES NOT SHOW is that a NON-EMPTY list keeps
 * `COGNITO` out** — no real provider exists to check it against. That half is
 * the fixture's, inside the gate, and the day a provider lands somebody must
 * re-run the two requests above rather than quoting this paragraph.
 */

import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'

import {
  AWS_REGION,
  COGNITO_PROVIDER_HANDLE_PATTERN,
  FEDERATED_CONNECTIONS,
  ENTRA_ENVIRONMENTS,
  assertMockSignInEnvironment,
  cognitoCallbackUrls,
  cognitoDomainPrefix,
  cognitoIdpResponseUrl,
  entraClientSecretName,
  cognitoHostedUiHost,
  cognitoProviderName,
  cognitoSignOutUrls,
  userPoolClientName,
  userPoolName,
} from './config.ts'
import type { BrokeredOidcConnection, Environment, FederatedConnection } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

export interface IdentityStackProps extends StackProps {
  readonly environment: Environment
  /**
   * The federated connections to register as IdPs. Defaults to
   * `FEDERATED_CONNECTIONS`, which is EMPTY.
   *
   * ⚠️ IT IS A PROP SO A FIXTURE CAN PASS A NON-EMPTY LIST, AND THAT IS NOT A
   * CONVENIENCE — IT IS THE ONLY WAY THE PROVIDER FACTORY IS EVER WITNESSED.
   * With the real list empty, `cdk synth` renders zero providers, so a green
   * gate would prove nothing about the code below: `docs/HANDOFF.md` §5.6, a
   * control that cannot be witnessed asserts nothing. The same argument
   * `StorageStack.tenantKeyHandles` makes, at a second service.
   */
  readonly connections?: readonly FederatedConnection[]
  /**
   * G2767 — THE OWNER'S RULING: staging federates Microsoft Entra ID. `null`
   * or absent renders no OIDC provider at all; `lib/app.ts` builds it from
   * deploy context with `entraConnectionFromContext()`.
   */
  readonly entra?: BrokeredOidcConnection | null
  /**
   * G2996 — THE OWNER'S RULING G2771: the STAGING MOCK sign-in's three doors,
   * as three OIDC providers pointed at the `MockIdp` function. `null` or
   * absent renders none; `lib/app.ts` builds it from `-c mockIdpIssuer` with
   * `mockIdpConnectionsFromContext()`, which refuses outside staging.
   */
  readonly mockIdp?: readonly BrokeredOidcConnection[] | null
}

/**
 * G2768 (derived) — an OIDC provider's secret is a REFERENCE, never a value,
 * and only on an environment the owner ruled. Throws at synth otherwise.
 */
export function assertOidcSecretByReference(
  connection: BrokeredOidcConnection,
  environment: Environment,
): void {
  assertOpaqueProviderHandle(connection.handle)
  if (!ENTRA_ENVIRONMENTS.includes(environment)) {
    throw new Error(`G2767: an OIDC connection is ruled for staging alone, not '${environment}'.`)
  }
  if (!/^reconcile-[a-z]+-[a-z0-9-]+$/.test(connection.clientSecretName)) {
    throw new Error(
      `G2768: '${connection.clientSecretName}' is not a Secrets Manager secret NAME. The client ` +
        'secret is read by dynamic reference at deploy and never written into the template.',
    )
  }
}

/**
 * 🛑 THE HANDLE GUARD. It throws, at synth, on anything that is not sixteen hex
 * characters — which is to say, on a tenant id.
 *
 * `COGNITO_PROVIDER_HANDLE_PATTERN` in `lib/config.ts` carries the argument: a
 * provider name is readable through `cognito-idp:ListIdentityProviders` AND is
 * quoted back in the hosted UI's own `identity_provider` query parameter, so a
 * tenant id in one is a tenant enumeration in the clear — the disclosure G260
 * refuses through a tag, at the fourth API this record has caught carrying it.
 * `RequiredTagsAspect` is blind to it, because a provider name is not a tag.
 *
 * Witnessed RED: `infra/test-fixtures/identity-named-tenant.ts` passes
 * `ten_acme` and the synth must fail.
 */
export function assertOpaqueProviderHandle(handle: string): void {
  if (COGNITO_PROVIDER_HANDLE_PATTERN.test(handle)) return
  throw new Error(
    `G302/G260: '${handle}' is not an opaque connection handle. A Cognito ` +
      'provider name is readable through cognito-idp:ListIdentityProviders and ' +
      'is echoed in the hosted UI identity_provider query parameter, so a tenant ' +
      'id in one publishes a customer to everybody watching an address bar. A ' +
      'handle is sixteen hex characters, minted at random (openssl rand -hex 8) ' +
      'and NEVER derived from the tenant id: tenant ids are low-entropy slugs, so ' +
      'a hash of one is recovered by guessing forward. The handle-to-connection ' +
      'join belongs in the control-plane catalogue, behind a grant.',
  )
}

/**
 * 🛑 **SAML ONLY, AND THE REFUSAL OF OIDC IS G263 TAKEN SERIOUSLY RATHER THAN
 * A FEATURE NOBODY GOT TO.**
 *
 * G263 forbids a static key and G302 repeats the qualification: *"An IdP client
 * secret is a real secret — if one is unavoidable, it goes in Secrets Manager
 * with rotation, and you say so."* **This is the saying-so, and the conclusion
 * is that Secrets Manager does not buy what the sentence assumes it buys.**
 *
 * · **A SAML connection has no secret.** Cognito fetches the IdP's metadata
 *   document over HTTPS and validates assertions against a signing certificate
 *   inside it. Nothing this product holds is a credential; the trust is a
 *   public key and a URL.
 * · **An OIDC connection has one, and COGNITO STORES THE VALUE.**
 *   `ProviderDetails.client_secret` is written into the user pool, not read
 *   from anywhere at sign-in time. So putting it in Secrets Manager puts it in
 *   **two** places — and **rotating it in Secrets Manager does not rotate it in
 *   Cognito.** A CloudFormation dynamic reference resolves ONCE, at deploy, and
 *   copies the value across; after that the two drift silently and the
 *   rotation schedule is a control that reports success over a secret nothing
 *   re-reads. **A rotation that does not rotate is worse than no rotation,
 *   because it is recorded as one** — the shape `docs/HANDOFF.md` §5.6
 *   catalogues, arriving at a credential.
 *
 * ⚠️ **WHAT WOULD MAKE OIDC ADMISSIBLE IS NAMED RATHER THAN INVENTED:** a
 * rotation whose final step is an `UpdateIdentityProvider` call against this
 * pool — so the schedule rotates the secret AT the place that holds it — plus
 * a decision about which principal may hold `cognito-idp:UpdateIdentityProvider`
 * in a shared account. **That is a ruling, and this slice does not take it.**
 * Most enterprise directories (Entra ID, Okta, Ping) offer SAML, so the refusal
 * costs less than it looks.
 *
 * Witnessed RED: `infra/test-fixtures/identity-oidc-secret.ts`.
 */
export function assertNoStoredClientSecret(connection: FederatedConnection): void {
  if (connection.protocol === 'saml') return
  throw new Error(
    `G263/G302: connection '${connection.handle}' is protocol '${connection.protocol}'. ` +
      'An OIDC connection carries a client_secret and Cognito stores the VALUE, ' +
      'not a reference - so Secrets Manager holds a second copy and rotating it ' +
      'there does not rotate it in Cognito. A rotation that does not rotate is ' +
      'recorded as one, which is worse than none. SAML needs no secret at all: ' +
      'Cognito fetches metadata over HTTPS and trusts a signing certificate. ' +
      'Admitting OIDC needs a rotation whose last step is UpdateIdentityProvider ' +
      'against this pool, and a decision about who may hold that verb in a shared ' +
      'account. Neither exists; this is a ruling, not an implementation detail.',
  )
}

export class IdentityStack extends Stack {
  readonly userPool: cognito.UserPool
  readonly userPoolClient: cognito.UserPoolClient
  readonly domain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props)

    const { environment } = props
    const connections = props.connections ?? FEDERATED_CONNECTIONS
    const mockDoors = props.mockIdp ?? []
    if (mockDoors.length > 0) assertMockSignInEnvironment(environment)

    for (const connection of connections) {
      assertOpaqueProviderHandle(connection.handle)
      assertNoStoredClientSecret(connection)
    }

    // ------------------------------------------------------- 1. the pool

    /**
     * 🛑 ONE POOL FOR THE WHOLE FLEET. `COGNITO_ONE_POOL_BECAUSE` in
     * `lib/config.ts` argues it: `cognito-idp:ListUserPools` takes no resource,
     * so a pool per tenant publishes the customer list to anybody holding one
     * account-wide permission — G260's disclosure at a fourth API, invisible to
     * G260's own Aspect.
     */
    this.userPool = new cognito.UserPool(this, 'Pool', {
      userPoolName: userPoolName(environment),

      /* FENCE 1a. No self-registration. This renders
       * `AdminCreateUserConfig.AllowAdminCreateUserOnly: true`, so an
       * unauthenticated caller cannot put a row in this directory at all. */
      selfSignUpEnabled: false,

      /* FENCE 1b. 🛑 NO SELF-SERVICE RECOVERY, AND IT IS NOT AUSTERITY.
       * "Forgot password" is a native-user mechanism that mints a credential
       * over email. There are no passwords here that anybody is meant to use,
       * so a recovery flow would be the one unauthenticated path into a
       * directory this stack spends three fences keeping people out of. */
      accountRecovery: cognito.AccountRecovery.NONE,

      /* ⚠️ G223. AN ASSERTION, NOT A DEFAULT — see the header. The second
       * factor is the customer IdP's, `Session.secondFactorAt` is a field-level
       * drop under the same ruling, and a federated sign-in never presents a
       * credential to Cognito for a second factor to sit in front of. */
      mfa: cognito.Mfa.OFF,

      /* 🛑 THE PASSWORD POLICY GOVERNS A DIRECTORY THAT MUST STAY EMPTY, AND IT
       * IS SET ANYWAY. It is the third fence, never the first: if a native user
       * ever exists it was created by an administrator, and this is what stops
       * that administrator from choosing `Passw0rd!`. Writing no policy would
       * leave Cognito's default, which is weaker and which nobody chose. */
      passwordPolicy: {
        minLength: 20,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(1),
      },

      /* ⚠️ NO REQUIRED STANDARD ATTRIBUTES, AND NO AUTO-VERIFIED ONES.
       * A federated user's attributes arrive by ATTRIBUTE MAPPING, which is
       * configured per identity provider and of which there are none. Marking
       * `email` required would make every future mapping mandatory and would
       * make this pool store an address for every person in the fleet before
       * anybody decided it should; marking it auto-verified would have Cognito
       * mail people on our behalf about an address the IdP already asserted.
       * `db/migrations/0009` makes the same argument one layer down about the
       * `email` column it stores and nothing selects. */
      standardAttributes: {},

      /* 🛑 `FeaturePlan.LITE` IS EXPLICIT AND IS A G223 CONSEQUENCE. The only
       * thing ESSENTIALS or PLUS buys that this product could want is THREAT
       * PROTECTION - adaptive authentication, risk scoring, compromised
       * credential detection. Every one of those is a judgement about a
       * PASSWORD and about a person's sign-in behaviour, and G223 puts both
       * with the customer's IdP. Buying a risk engine for a directory with no
       * users would be paying per month for a control that scores nobody.
       * ⚠️ WHAT IT COSTS: no managed-login branding. The classic hosted UI is
       * what this pool serves, and the sign-in page a customer sees is
       * therefore unstyled until somebody rules otherwise. */
      featurePlan: cognito.FeaturePlan.LITE,

      /* 🛑 DELETION PROTECTION AND `RETAIN`, AND THE REASON IS NOT CAUTION.
       * A user pool holds the LINK between a federated identity and a Cognito
       * user; deleting it orphans every person in the fleet at once and there
       * is no restore. ⚠️ THE PRICE IS TRAP 3 of `docs/build/deploy-handoff.md`
       * §3 - *"a rolled-back stack RETAINS resources; the next deploy fails
       * with already exists"* - and it is why the DOMAIN below is NOT retained:
       * a pool name is not unique, so a retained pool blocks nothing, while the
       * domain prefix is unique across all of AWS and a retained one would
       * block every future deploy in a namespace we could not clear. */
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    // ----------------------------------------------------- 2. the domain

    /**
     * 🛑 THE PREFIX IS GLOBALLY UNIQUE ACROSS ALL OF AWS AND IS READ BY THE
     * WHOLE INTERNET. `cognitoDomainPrefix()` in `lib/config.ts` argues the
     * choice, the disclosure it accepts (an account id, in a browser bar) and
     * the one it refuses (a tenant, anywhere), and names the custom domain
     * `auth.reconcileai.app` as the right answer — blocked on an apex A record
     * that Route 53 confirms does not exist.
     *
     * ⚠️ `RemovalPolicy.DESTROY` IS DELIBERATE AND IS THE OPPOSITE OF THE
     * POOL'S. The domain holds no state; the prefix is a global name. A
     * retained domain after a rolled-back stack is trap 3 with a namespace we
     * cannot clear, which is strictly worse than recreating a thing that
     * carries nothing.
     */
    this.domain = new cognito.UserPoolDomain(this, 'Domain', {
      userPool: this.userPool,
      cognitoDomain: { domainPrefix: cognitoDomainPrefix(environment) },
    })
    this.domain.applyRemovalPolicy(RemovalPolicy.DESTROY)

    // ----------------------------------------------------- 3. the client

    /**
     * 🛑 ONE APP CLIENT, PUBLIC, AND EVERY FIELD ON IT IS A REFUSAL OF
     * SOMETHING.
     */
    this.userPoolClient = new cognito.UserPoolClient(this, 'BrowserClient', {
      userPool: this.userPool,
      userPoolClientName: userPoolClientName(environment),

      /* G263. A PUBLIC CLIENT: a secret shipped to a browser is a static
       * credential published to every viewer. PKCE is the browser's half of
       * this and is a NAMED FRONTEND GAP - `frontend/` has no callback route to
       * put it in (see `cognitoCallbackUrls()`), so nothing here may claim it. */
      generateSecret: false,

      /* ┌─ 🛑 FENCE 2a. THE ONLY NON-FEDERATED FLOW IS REFRESH-TOKEN ─────────┐
       * │ EXCHANGE, WHICH REQUIRES A TOKEN THE CALLER ALREADY HAS.            │
       * └────────────────────────────────────────────────────────────────────┘
       * Passing `{ userPassword: false }` is NOT the same as passing `{}`:
       * `aws-cdk-lib` returns `undefined` for an empty object, which OMITS
       * `ExplicitAuthFlows` and leaves Cognito's legacy default
       * (`USER_SRP_AUTH`, `CUSTOM_AUTH`, `REFRESH_TOKEN_AUTH`). One explicit
       * `false` makes the list render, and what renders is
       * `['ALLOW_REFRESH_TOKEN_AUTH']` alone.
       *
       * ⚠️ WHAT THAT REFUSES, PRECISELY: `InitiateAuth` and `AdminInitiateAuth`
       * with `USER_PASSWORD_AUTH`, `USER_SRP_AUTH`, `ADMIN_USER_PASSWORD_AUTH`
       * or `USER_AUTH` are refused BY THE POOL, whatever password the directory
       * holds and whoever asks. That refusal is witnessed against AWS in this
       * slice's report by creating a native user, setting a permanent password
       * and being turned away - which is the only kind of evidence
       * `deploy-handoff.md` trap 10 accepts. */
      authFlows: { userPassword: false },

      oAuth: {
        flows: {
          /* The authorization-code grant, and ONLY it. */
          authorizationCodeGrant: true,
          /* 🛑 THE IMPLICIT GRANT IS REFUSED. It returns tokens in the URL
           * FRAGMENT, where they land in browser history, in `Referer` headers
           * and in anything reading an address bar. It exists for clients that
           * cannot do a back-channel exchange; ours can. */
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          /* 🛑 `aws.cognito.signin.user.admin` IS ABSENT AND THE ABSENCE IS THE
           * DECISION. That scope lets the ACCESS TOKEN call Cognito's own user
           * APIs as the signed-in person - reading and WRITING their own
           * attributes, including any this product later maps an authorisation
           * term from. A token that can edit the directory it was issued
           * against is a token that can edit the evidence. CDK adds it by
           * default when `scopes` is omitted; naming the three is how it stays
           * out. */
        ],
        callbackUrls: [...cognitoCallbackUrls()],
        logoutUrls: [...cognitoSignOutUrls()],
      },

      /* ⚠️ `PreventUserExistenceErrors: ENABLED`, AND IT IS THE SAME ARGUMENT
       * `session.openapi.yaml` MAKES ABOUT `resolveHomeRealm`: *"returning 404
       * for an unknown address is the natural thing to write and it is a
       * user-existence oracle."* The contract holds that line by never being
       * given a person; this holds it by making Cognito's own refusals
       * indistinguishable. Two layers, one property. */
      preventUserExistenceErrors: true,

      /* ┌─ 🛑 THE COGNITO TOKEN LIVES FOR THE LENGTH OF A REDIRECT, NOT THE ──┐
       * │ LENGTH OF A SESSION, AND THAT IS G160's SHAPE RATHER THAN THRIFT.   │
       * └─────────────────────────────────────────────────────────────────────┘
       * `model/access.ts` refuses the JWT shape outright - *"A REFERENCE, NOT A
       * BEARER TOKEN"* - so the credential this product carries is a `Session`
       * row reached by a digested handle, and the Cognito token is consumed
       * ONCE, at the callback, and never presented again. Five minutes is the
       * floor Cognito permits and is more than a redirect needs. The refresh
       * token is set to its own floor of sixty minutes because nothing here
       * refreshes: a token nobody exchanges should expire as soon as the
       * service allows. */
      accessTokenValidity: Duration.minutes(5),
      idTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.minutes(60),
      enableTokenRevocation: true,

      /* FENCE 2b. The derived federated list - EMPTY today. See the override
       * immediately below, which is what stops the empty list meaning its
       * opposite. */
      supportedIdentityProviders: [
        ...connections.map((connection) =>
          cognito.UserPoolClientIdentityProvider.custom(cognitoProviderName(connection.handle)),
        ),
        ...(props.entra ? [cognito.UserPoolClientIdentityProvider.custom(cognitoProviderName(props.entra.handle))] : []),
        ...mockDoors.map((door) => cognito.UserPoolClientIdentityProvider.custom(cognitoProviderName(door.handle))),
      ],
    })

    /**
     * ┌─ 🛑 THE ONE LINE THIS FILE'S HEADER IS ABOUT. DO NOT DELETE IT AS ─────┐
     * │ REDUNDANT: IT IS REDUNDANT ONLY WHEN THE LIST IS NON-EMPTY, AND THE    │
     * │ LIST IS EMPTY.                                                         │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * `aws-cdk-lib` renders an EMPTY `supportedIdentityProviders` as an OMITTED
     * property (`if (providers.length !== 0) return ...`), and an omitted
     * `SupportedIdentityProviders` is Cognito's default, which is `COGNITO` —
     * the native directory. So the array that says *no native sign-in* would
     * have said *native sign-in only*, in a template that looks correct.
     *
     * Writing it onto the L1 resource unconditionally makes the empty list
     * survive as an empty list. `tests/infra/identity.test.mjs` asserts the
     * property is PRESENT and free of `COGNITO` over the real template and over
     * the fixture, because an assertion over an empty list alone would pass
     * whatever the code did.
     *
     * ⚠️ AND A SYNTHESISED PROPERTY IS NOT A PROPERTY THE SERVICE ACCEPTED —
     * trap 10, which cost G287 a key policy that passed `tsc`, synth, the gate
     * and a clean deploy and was then refused by KMS. What Cognito STORES for
     * an empty list is read back from AWS in this slice's report with
     * `describe-user-pool-client`, not asserted here.
     */
    const cfnClient = this.userPoolClient.node.defaultChild as cognito.CfnUserPoolClient
    cfnClient.addPropertyOverride('SupportedIdentityProviders', [
      ...connections.map((connection) => cognitoProviderName(connection.handle)),
      ...(props.entra ? [cognitoProviderName(props.entra.handle)] : []),
      ...mockDoors.map((door) => cognitoProviderName(door.handle)),
    ])

    // -------------------------------------------- 4. the providers, if any

    /**
     * 🛑 ZERO OF THESE EXIST TODAY AND THE LOOP IS WITNESSED BY A FIXTURE
     * RATHER THAN BY THE TREE — `StorageStack`'s key factory, at a second
     * service, for the same §5.6 reason.
     *
     * ⚠️ `attributeMapping` IS DELIBERATELY ABSENT AND IS NOT AN OVERSIGHT.
     * Which SAML assertion attribute becomes which Cognito attribute is a
     * decision about what this product STORES about a customer's staff, and
     * `db/migrations/0009` has already ruled the narrow version of that
     * question one layer down: `PrincipalContext` is *"structurally narrowed to
     * `{ userId, status }` … so that no evaluation can reach an email, a
     * display name, or the `identityProvider` field the org axis is derived
     * from."* Mapping attributes here before that boundary is re-argued would
     * be deciding it by side effect. **The commit that creates the first real
     * connection owns the mapping, beside the migration that records the
     * connection.**
     */
    for (const connection of connections) {
      new cognito.UserPoolIdentityProviderSaml(this, `Provider${connection.handle}`, {
        userPool: this.userPool,
        name: cognitoProviderName(connection.handle),
        metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(connection.metadataUrl),

        /* 🛑 IdP-INITIATED SAML IS OFF, AND IT IS THE ONE DEFAULT HERE WORTH
         * WRITING DOWN RATHER THAN INHERITING. An IdP-initiated flow accepts an
         * UNSOLICITED assertion — there is no request for it to answer, so
         * there is no `RelayState` bound to a session the browser started, and
         * a captured or replayed assertion posted to the ACS URL signs someone
         * in. Cognito defaults it to `false`; it is spelled out because a later
         * reader asked for it by a customer will otherwise turn it on without
         * meeting this paragraph. `idpInitiatedAuth` stays absent for the same
         * reason `encryptedResponses` is `false`: neither is decided by
         * silence. */
        idpSignout: false,
        encryptedResponses: false,

        /* ⚠️ THIS SIGNS THE `AuthnRequest` COGNITO SENDS, and it does NOT
         * govern whether the IdP's assertion is signed — that is a property of
         * the metadata document and of Cognito's own verification, and this
         * flag has no say in it. Stated because the name reads like the
         * opposite. What it buys is that the IdP can prove a sign-in request
         * came from this pool, which is what makes an IdP able to refuse an
         * attacker-composed request naming our ACS URL. */
        requestSigningAlgorithm: cognito.SigningAlgorithm.RSA_SHA256,
      })
    }

    // ------------------------------------------- 4b. Entra ID, OIDC (G2767)

    /**
     * 🛑 THE OWNER'S RULING, 2 Oct 2026: *"staging federates Microsoft Entra
     * ID through the Cognito broker."* The SECRET is created HERE and EMPTY —
     * a person puts the value (`EntraClientSecretNeedsAValue`) — and the
     * provider reads it by DYNAMIC REFERENCE, so the template never carries
     * it. The provider is rendered only when the owner passes the Entra
     * directory and client ids by context; the secret exists either way so it
     * can be filled before the provider that reads it is deployed.
     *
     * ⚠️ THE TWO-STEP IS FORCED, NOT TIDY: CloudFormation resolves a dynamic
     * reference at deploy, so a provider deployed against the EMPTY secret
     * would be created with an empty `client_secret`. Deploy once without the
     * ids (the secret appears), put the value, deploy again with the ids.
     */
    const entraSecret = ENTRA_ENVIRONMENTS.includes(environment)
      ? new secretsmanager.Secret(this, 'EntraClientSecret', {
          secretName: entraClientSecretName(environment),
          description:
            'G2767 - the Entra app registration client secret. Created EMPTY: put ' +
            '{"clientSecret":"<value>"} before deploying Identity with -c entraTenantId/entraClientId.',
          generateSecretString: {
            secretStringTemplate: JSON.stringify({ clientSecret: '' }),
            generateStringKey: 'unused',
            passwordLength: 16,
          },
        })
      : null
    const entra = props.entra ?? null
    if (entra !== null) {
      assertOidcSecretByReference(entra, environment)
      const provider = new cognito.UserPoolIdentityProviderOidc(this, `Provider${entra.handle}`, {
        userPool: this.userPool,
        name: cognitoProviderName(entra.handle),
        clientId: entra.clientId,
        /* A DYNAMIC REFERENCE, resolved by CloudFormation at deploy. */
        clientSecret: SecretValue.secretsManager(entra.clientSecretName, {
          jsonField: 'clientSecret',
        }).unsafeUnwrap(),
        issuerUrl: entra.issuerUrl,
        scopes: ['openid', 'email', 'profile'],
        attributeRequestMethod: cognito.OidcAttributeRequestMethod.GET,
        /* R6's claim map reads `email` and `name` off the BROKER's token; these
         * two mappings are what put them there. Entra must emit `email` as an
         * optional ID-token claim (the runbook's step). */
        attributeMapping: {
          email: cognito.ProviderAttribute.other('email'),
          fullname: cognito.ProviderAttribute.other('name'),
        },
      })
      /* Cognito refuses a client naming a provider that does not exist yet. */
      this.userPoolClient.node.addDependency(provider)
    }

    // ------------------------------- 4c. the STAGING MOCK doors (G2996)

    /**
     * 🛑 THE OWNER'S RULING G2771 — A PUBLIC TEST LOGIN ON STAGING, ACCEPTED IN
     * WRITING. Three providers, one per mock door (a door has ONE owner, so a
     * customer, a partner and a platform persona cannot share one), all
     * pointed at the one `MockIdp` function and told apart by `client_id`.
     * The secret is the GENERATED one `MockIdp` created, by dynamic reference
     * — exactly G2768's shape for Entra, so the template carries no value.
     *
     * ⚠️ `email_verified` IS MAPPED HERE AND NOT FOR ENTRA, AND THE DIFFERENCE
     * IS THE DOOR'S, NOT A PREFERENCE: the mock door states it as `true`
     * because every mock address is under a domain this product's own zone
     * holds, which is what a verifier would prove (G2999).
     */
    for (const door of mockDoors) {
      assertOidcSecretByReference(door, environment)
      const provider = new cognito.UserPoolIdentityProviderOidc(this, `Provider${door.handle}`, {
        userPool: this.userPool,
        name: cognitoProviderName(door.handle),
        clientId: door.clientId,
        clientSecret: SecretValue.secretsManager(door.clientSecretName, {
          jsonField: 'clientSecret',
        }).unsafeUnwrap(),
        issuerUrl: door.issuerUrl,
        scopes: ['openid', 'email', 'profile'],
        attributeRequestMethod: cognito.OidcAttributeRequestMethod.GET,
        attributeMapping: {
          email: cognito.ProviderAttribute.other('email'),
          emailVerified: cognito.ProviderAttribute.other('email_verified'),
          fullname: cognito.ProviderAttribute.other('name'),
        },
      })
      this.userPoolClient.node.addDependency(provider)
    }

    // ---------------------------------------------------------- 5. tags

    /**
     * ⚠️ `Plane=edge`, AND THE VALUE IS ARGUED RATHER THAN PICKED.
     *
     * G260 says invariant 3 is auditable from a tag query — *"a `Plane=control`
     * resource with a route to a `Plane=data` cluster is a finding"* — so the
     * value must not lie, and `data` and `control` would both be lies: **one
     * pool serves the consoles and every tenant**, and it has a route to
     * neither cluster. `shared` was the other candidate and is what the VPC
     * carries for exactly this reason. `edge` is taken because this is a
     * browser-facing front door, which is what the other `edge` resources are
     * and what `shared` does not say.
     *
     * 🛑 WHAT THE TAG DOES NOT SAY, AND IT IS WORTH SAYING HERE: a pool with
     * federated users holds a LINKED USER RECORD PER PERSON, carrying whatever
     * a future attribute mapping asserts. That is personal data belonging to
     * customers' staff, in one directory, across every tenant. No tag makes it
     * otherwise, and `COGNITO_ONE_POOL_BECAUSE` in `lib/config.ts` states the
     * cost against the enumeration it buys instead.
     */
    applyRequiredTags(this, environment, 'edge')

    // ------------------------------------------------------- 6. outputs

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'G302 - the broker. One pool for the fleet; a pool per tenant enumerates tenants.',
    })

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Public client, no secret (G263). Refresh-token exchange is its only native flow.',
    })

    new CfnOutput(this, 'HostedUiHost', {
      value: cognitoHostedUiHost(environment),
      description: 'Globally unique across AWS and read by every person who signs in.',
    })

    /**
     * 🛑 THE ISSUER AND THE JWKS URI ARE OUTPUTS BECAUSE THE SERVER WILL NEED
     * THEM AND HAS NOWHERE TO READ THEM FROM — a gap this slice NAMES and does
     * not fill, because `server/` is another agent's.
     *
     * `server/data-plane/config.ts` reads `RECONCILE_DATA_*` and knows nothing
     * about a user pool; `server/data-plane/session.ts` picks its resolver ONCE
     * at boot, between the G192 test token and a production resolver that does
     * not exist. Validating a Cognito id token needs the issuer, the JWKS
     * document and the audience, and **there is no configuration path carrying
     * any of the three into either plane.** That path, plus the mounting of
     * `completeFederatedSignIn`, is what stands between this stack and a person
     * signing in.
     */
    new CfnOutput(this, 'Issuer', {
      value: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${this.userPool.userPoolId}`,
      description: 'What a token validator must pin. No plane reads it today; that gap is named.',
    })

    if (entraSecret !== null) {
      new CfnOutput(this, 'EntraRedirectUri', {
        value: cognitoIdpResponseUrl(environment),
        description:
          'G2767 - register EXACTLY this as a Web redirect URI on the Entra app registration.',
      })
      new CfnOutput(this, 'EntraClientSecretNeedsAValue', {
        value: entraClientSecretName(environment),
        description:
          'Created EMPTY. A person must put {"clientSecret":"<value>"} here, then redeploy ' +
          'Identity with -c entraTenantId and -c entraClientId. Rotation = put + redeploy.',
      })
    }

    if (mockDoors.length > 0) {
      new CfnOutput(this, 'MockDoorsAreATestLogin', {
        value:
          `${mockDoors.length} STAGING MOCK providers (${mockDoors.map((d) => cognitoProviderName(d.handle)).join(', ')}) ` +
          'point at the MockIdp test door. Anybody with the mock password signs in as a mock persona. G2771.',
        description: 'The owner accepted this for staging alone; synth refuses it anywhere else.',
      })
    }

    new CfnOutput(this, 'FederatedConnectionCount', {
      value: String(connections.length),
      description:
        'ZERO providers means nobody can sign in at all. tenant.identity_connection ' +
        'has no column for a provider name, so a door here would have no row behind it.',
    })

    /* 🛑 THE SENTENCE A LATER READER NEEDS MOST, PUT WHERE THE CONSOLE SHOWS
     * IT. A pool cannot forbid its own native directory; what keeps a native
     * user from reaching anything is that orgClass has exactly one producer. */
    new CfnOutput(this, 'WhyNoNativeUsers', {
      value:
        'a native Cognito user has no owning directory, so orgFor() has nothing to derive from. ' +
        'This pool narrows the path; server/data-plane/identity.ts refuses it by name at ' +
        'owner_unresolvable. G302, and G289 priced the shortcut at five deleted controls.',
      description: 'G302.',
    })
  }
}
