-- =====================================================================
-- 0270 — WHERE A SOURCE CREDENTIAL IS, AND NOTHING OF WHAT IT IS
--
-- G2401, THE OWNER'S RULING OF 1 Oct 2026, quoted rather than paraphrased:
--   *"Source credential custody: Secrets Manager, one secret per source,
--     encrypted with the tenant's per-tenant KMS key (Storage's key factory);
--     only a credentialRef lives in Postgres; the FDE binds a credential via a
--     write path under G75's secret reach."*
--
-- TWO TABLES, ONE FILE, so the count moves by ONE — a migration is a FILE and
-- not a table, which is `0180`'s distinction.
--
-- 🛑 THE STRONGEST THING IN THIS FILE IS A COLUMN THAT DOES NOT EXIST, AND IT
--    IS `0022`'s MOVE ONE TABLE OVER: there is no `secret`, no `credential`,
--    no `password`, no `value` column and there must never be one. *"Only a
--    credentialRef lives in Postgres"* is held here by ABSENCE, and by a test
--    that does not trust the absence — `tests/db/endpoint-credential-ref.test.ts`
--    §4 binds a credential through the served path and then searches EVERY
--    relation in schemas `tenant` and `public`, every row cast to text, for
--    the value it bound. A future column that captured it — a debug column, a
--    `jsonb` "last request" — is a red gate rather than a leak.
-- =====================================================================


-- =====================================================================
-- §1  `tenant.endpoint` — `Endpoint`'s ROW, NARROWED TO WHAT HAS A READER
--
-- `model/domain.ts`'s `Endpoint` has ELEVEN fields. `intake_channel.endpoint_id`
-- (`0012`) has pointed at a row that did not exist since 19 Sep 2026, exactly
-- as `document_type_id` did before `0180`. This slice gives it a row and gives
-- the row FIVE columns, on `0004`'s rule — *a column ahead of its reader is
-- refused* — applied field by field:
--
--   `tenant_id`, `id`                      the key; the policy keys on the first
--   `credential_ref`                       `Endpoint.credentialRef`. READ by the
--                                          bind operation (rotation reuses it)
--   `credential_bound_at`                  READ back as the 200's `boundAt`
--   `credential_bound_authorization_id`    invariant 10: WHICH AUTHORISATION
--                                          bound the credential now in force.
--                                          Not on the model — see §1b.
--
-- REFUSED BY NAME, each for the same reason — nothing in this slice reads it,
-- and its WRITER is "Declare a source", a C9 row that is not built:
--   `label`, `direction`, `address`, `verified_at`, `verification_expires_at`,
--   `writeback_enabled`, `bound_until`, `disabled_at`.
-- ⚠️ `address` IS THE ONE A READER WILL MISS, and its absence is deliberate:
--   for SFTP it is a host, for S3 a bucket and a role ARN, and the pack calls
--   per-kind configuration *"the largest gap on the surface"*. Inventing one
--   opaque text column for it here would be the shape `0160` refused for a
--   definition's spec — a `jsonb`-in-all-but-name nobody can read.
--
-- §1a  ⚠️ `intake_channel.endpoint_id` GAINS NO FOREIGN KEY HERE. Every
--   fixture that seeds a `connector_pull` channel names an endpoint id with no
--   row behind it, and G88 makes this file forward-only; adding the FK is a
--   deliberate later act with its own migration, not a side effect of this one.
--
-- §1b  🛑 `credential_bound_authorization_id` IS NOT ON `Endpoint` AND IS NOT
--   A MODEL CHANGE SMUGGLED IN. `MAX_AUTHORIZATION_SECONDS.secret` is 60
--   precisely because binding a credential is ONE ACT, and the row that says
--   which credential is in force is the only place that act's record can be
--   joined from. It is NOT a foreign key into `tenant.authorization_grant`: a
--   retention sweep of the audit trail must not cascade into the binding.
-- =====================================================================

CREATE TABLE tenant.endpoint (
  tenant_id text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id        text NOT NULL,

  -- An OPAQUE HANDLE and never key material. The secret NAME is derived from
  -- it (`infra/lib/config.ts`'s `sourceCredentialSecretName()`), and the
  -- handle is RANDOM — minted by the data plane at first bind — so the name
  -- discloses nothing about a tenant through `secretsmanager:ListSecrets`.
  credential_ref                    text,
  credential_bound_at               timestamptz,
  credential_bound_authorization_id text,

  PRIMARY KEY (tenant_id, id),

  -- 🛑 A SHAPE CHECK, AND IT IS NOT `0007`'s REFUSED VOCABULARY CHECK — the
  --    distinction is the argument. `0007` and `0069` refuse a CHECK that
  --    transcribes a CLOSED VOCABULARY, because an unknown value must reach
  --    the model as a refusal rather than be rejected by a list somebody
  --    forgot to extend. This is not a vocabulary. It makes a credential
  --    VALUE UNSTORABLE in the one column whose job is to hold a reference to
  --    one — a caller-supplied password is not 32 lowercase hex characters
  --    behind the literal prefix `cred_`, so the obvious bug (writing the body
  --    field into the ref column) is a constraint violation, not a leak.
  CONSTRAINT endpoint_credential_ref_is_a_handle
    CHECK (credential_ref IS NULL OR credential_ref ~ '^cred_[0-9a-f]{32}$'),

  -- The three move together: a handle with no binding instant, or an instant
  -- with no handle, is a row nothing in this slice can produce and a reader
  -- would have to defend against. §5.5 — unrepresentable beats refused.
  CONSTRAINT endpoint_credential_binding_is_whole
    CHECK (
      (credential_ref IS NULL) = (credential_bound_at IS NULL)
      AND (credential_ref IS NULL) = (credential_bound_authorization_id IS NULL)
    )
);

ALTER TABLE tenant.endpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint FORCE  ROW LEVEL SECURITY;

-- 0001's predicate VERBATIM, on `USING` AND on `WITH CHECK`. ⚠️ `FOR ALL` IS
-- CORRECT HERE AND THE `0027`/`0220` DEFECT DOES NOT APPLY, and the difference
-- is named because a reader who knows those two will look for it: their
-- implicit `WITH CHECK` was derived from a value the CALLER controlled
-- (`app.claimed_domain`) or admitted a row for ANOTHER PERSON. This one is the
-- tenant predicate on a GUC set from the SESSION (invariant 1), and the app
-- role holds no `INSERT` at all.
CREATE POLICY endpoint_rls ON tenant.endpoint
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

-- 🛑 THE GRANTS ARE THE DECISION, AND THEY ARE G358's SHAPE A FIFTH TIME.
--
--   `SELECT` — the bind reads the row it binds, and locks it (`FOR UPDATE`
--      needs an `UPDATE` privilege on at least one column, which the next line
--      supplies and nothing wider).
--   `UPDATE (credential_ref, credential_bound_at, credential_bound_authorization_id)`
--      — COLUMN-LEVEL. The request path may BIND a credential to an endpoint;
--      it may not CREATE an endpoint, re-point one, enable write-back
--      (`enable_endpoint_writeback` is `authority`, never a delivery grant), or
--      move it to another tenant. G511: the writer
--      (`server/data-plane/credential-binding.ts`) lands in this commit.
--
--   NO `INSERT` — declaring a source is its own C9 row and is not built; a
--      path that could insert an endpoint could mint a pull target pointing at
--      a host it controls and then bind the customer's credential to it.
--   NO `DELETE` — *"A source that has delivered cannot be deleted"*; and a
--      deleted row would orphan a secret nothing could ever name again.
GRANT SELECT ON tenant.endpoint TO tenant_rw;
GRANT UPDATE (credential_ref, credential_bound_at, credential_bound_authorization_id)
  ON tenant.endpoint TO tenant_rw;


-- =====================================================================
-- §2  `tenant.tenant_key_handle` — WHICH KEY IS THIS TENANT'S
--
-- 🛑 THE RULING SAYS *"encrypted with the tenant's per-tenant KMS key"*, AND
--    NOTHING IN THE DATA DATABASE COULD NAME ONE. `infra/lib/config.ts` names
--    a tenant key by an OPAQUE HANDLE (`alias/reconcile-<env>-data-tk-<16 hex>`)
--    precisely so a `kms:ListAliases` caller cannot read the customer list,
--    and records that *"the handle-to-tenant join lives in the control-plane
--    catalogue, behind a grant."* **No such join exists in either database
--    today** — `DataPlanePlacement` has no column for it, which `storage-stack.ts`
--    says in its own output. Without a join the bind would have to choose
--    between refusing every request and encrypting under `aws/secretsmanager`,
--    the account's SHARED key — which is the outcome the ruling refuses.
--
-- So the data plane reads its tenant's handle from a row, under that tenant's
-- RLS scope. **One row per tenant, visible only to that tenant, so the join is
-- no enumeration**: a session in `ten_acme` can learn `ten_acme`'s handle and
-- no other.
--
-- ⚠️ NO WRITER, AND THAT IS `0004`'s RULE IN ITS PERMITTED DIRECTION: a column
--    WITH a reader and no request-path writer. The intended writer is
--    onboarding — G290's minter returns the handle, and nothing yet carries it
--    downward. Until a row exists the bind REFUSES (`tenant_key_absent`, a
--    500 `upstream_unavailable` on the wire) rather than encrypting under any
--    other key. `tests/http/credential-binding-served.test.ts` §6 witnesses it.
-- =====================================================================

CREATE TABLE tenant.tenant_key_handle (
  tenant_id  text NOT NULL PRIMARY KEY REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  -- `TENANT_KEY_HANDLE_PATTERN`, written once more as a constraint because a
  -- handle that is not this shape is an alias KMS will never resolve, and
  -- discovering that at the first bind is a 500 for a person typing a password.
  key_handle text NOT NULL CHECK (key_handle ~ '^[0-9a-f]{16}$')
);

ALTER TABLE tenant.tenant_key_handle ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.tenant_key_handle FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_key_handle_rls ON tenant.tenant_key_handle
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

-- `SELECT` and nothing else. A path that could write this row could point a
-- tenant's credentials at ANOTHER TENANT's key — whose key policy names the
-- same serving role, so the write would succeed and the custody boundary the
-- ruling buys would be one `UPDATE` deep.
GRANT SELECT ON tenant.tenant_key_handle TO tenant_rw;
