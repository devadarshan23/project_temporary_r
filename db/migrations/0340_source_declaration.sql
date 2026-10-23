-- =====================================================================
-- 0340 — DECLARING A SOURCE: WHERE IT IS, AND WHETHER IT IS STOPPED
--
-- C9 rows 1 (*Declare a source* — the declaration half), 3 (*Connection
-- configuration* — the SFTP and S3 halves), 20/35 (*Changing or stopping a
-- source* — the dated, reversible stop) and 24 (*The handoff has no state*).
-- G2681–G2690, 1 Oct 2026, DERIVED AND NOT THE OWNER'S.
--
-- `0270` §1 gave `tenant.endpoint` five columns and refused eight BY NAME —
-- `label`, `direction`, `address`, `verified_at`, `verification_expires_at`,
-- `writeback_enabled`, `bound_until`, `disabled_at` — each because *"its
-- WRITER is 'Declare a source', a C9 row that is not built"*. This file is
-- that writer's schema, and it re-asks `0004`'s question field by field
-- rather than taking all eight.
--
-- FOUR TABLES' WORTH OF CHANGE, ONE FILE, so the count moves by ONE.
-- =====================================================================


-- =====================================================================
-- §1  `tenant.endpoint` GAINS ITS DECLARATION
--
-- TAKEN, each with its reader:
--   `label`                      published by `listEndpoints`
--   `direction`                  published; `Endpoint.direction` is required
--   `connection_kind`            the discriminant the two config tables pin
--   `declared_at`                published
--   `declared_authorization_id`  invariant 10: WHICH AUTHORISATION DECLARED
--                                IT. `0270` §1b's argument, one column over —
--                                not a foreign key, because a retention sweep
--                                of the audit trail must not cascade here.
--
-- STILL REFUSED, BY NAME:
--   `address`        🛑 REPLACED RATHER THAN TAKEN. `0270` said it was *"the
--                    one a reader will miss"* and refused one opaque text
--                    column for it; the per-kind tables below ARE the address,
--                    typed. `Endpoint.address` is derived at read time.
--   `verified_at`, `verification_expires_at`
--                    verification is row 2's *"Test before declare"*, blocked
--                    on request-path egress (G2151). A column nobody can set
--                    honestly would read `NULL` for ever and look like a
--                    failed verification rather than an absent one.
--   `writeback_enabled`
--                    `enable_endpoint_writeback` is `authority` and a source
--                    is inbound; *"We pull; we never post."*
--   `bound_until`    the expiry of a STANDING grant, and nothing in this
--                    repository mints one (`0012` §2). `guardAuthorisation()`
--                    refuses a drawing lane with no bound — correctly — and
--                    that is the connector's fact to meet.
--   `disabled_at`    🛑 REPLACED RATHER THAN TAKEN, and §4 is why: a single
--                    timestamp makes the stop REVERSIBLE only by erasing it,
--                    and the pack says *"Disable is dated and reversible"*.
--
-- 🛑 `ADD COLUMN … NOT NULL` WITH NO DEFAULT REFUSES TO APPLY AGAINST A TABLE
--    HOLDING A ROW, AND THAT REFUSAL IS WANTED — `0140` §2's precedent. Until
--    this file `tenant.endpoint` had NO `INSERT` grant and no migration
--    inserts one, so a row there is one nobody had a privilege to write.
-- =====================================================================

ALTER TABLE tenant.endpoint ADD COLUMN label                     text        NOT NULL;
ALTER TABLE tenant.endpoint ADD COLUMN direction                 text        NOT NULL;
ALTER TABLE tenant.endpoint ADD COLUMN connection_kind           text        NOT NULL;
ALTER TABLE tenant.endpoint ADD COLUMN declared_at               timestamptz NOT NULL;
ALTER TABLE tenant.endpoint ADD COLUMN declared_authorization_id text        NOT NULL;

-- ⚠️ NO `CHECK` ON `direction` OR `connection_kind` — `0007`/`0069`'s
-- polarity: an unknown value reaches the model as a reader refusal, not a
-- write-time rejection by a list somebody forgot to extend. The reader in
-- `server/data-plane/sources.ts` refuses BY COLUMN.

-- The target the two config tables' composite foreign keys need. It is the
-- PK plus the discriminant, so it is unique by construction.
ALTER TABLE tenant.endpoint
  ADD CONSTRAINT endpoint_kind_key UNIQUE (tenant_id, id, connection_kind);


-- =====================================================================
-- §2  `tenant.endpoint_sftp` AND `tenant.endpoint_s3` — THE ADDRESS, TYPED
--
-- 🛑 TYPED COLUMNS AND NOT ONE `jsonb`, ON `0160`'s GROUND — *"a JSONB key
--    with no `FieldSpec` is UNREADABLE"*, and a connection blob nobody can
--    read is a connection nobody can audit. Cost accepted: a migration per
--    connection kind, forward-only under G88.
--
-- 🛑 AN S3 CONFIGURATION ON AN SFTP ENDPOINT IS UNREPRESENTABLE, NOT REFUSED.
--    Each table carries a `connection_kind` column pinned by a `CHECK` to ONE
--    value and a COMPOSITE FOREIGN KEY on `(tenant_id, endpoint_id,
--    connection_kind)` — G576's shape. The `CHECK` is a DISCRIMINANT PIN and
--    not `0007`'s refused vocabulary check: it names one constant that this
--    table IS, and a new kind arrives with a new table rather than by widening
--    a list.
--
-- ⚠️ NO `UPDATE` AND NO `DELETE` ON EITHER. Row 35: *"Rebinding a path or a
--    key is a new binding, not an edit: the binding history keeps both."*
--    Rebinding is NOT built (G2689); until it is, the configuration cannot be
--    edited at all, which is the honest shape of *"not an edit"*.
-- =====================================================================

CREATE TABLE tenant.endpoint_sftp (
  tenant_id   text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  endpoint_id text NOT NULL,
  connection_kind text NOT NULL DEFAULT 'sftp' CHECK (connection_kind = 'sftp'),

  host        text    NOT NULL,
  port        integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  path        text    NOT NULL,
  -- THE PINNED HOST KEY. A shape check, not a vocabulary — `0270`'s
  -- `credential_ref` argument: the obvious bug (writing a whole public key or
  -- a password here) is a constraint violation rather than a stored value.
  host_key_fingerprint text NOT NULL
    CHECK (host_key_fingerprint ~ '^SHA256:[A-Za-z0-9+/]{43}$'),

  PRIMARY KEY (tenant_id, endpoint_id),
  FOREIGN KEY (tenant_id, endpoint_id, connection_kind)
    REFERENCES tenant.endpoint (tenant_id, id, connection_kind)
);

CREATE TABLE tenant.endpoint_s3 (
  tenant_id   text NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  endpoint_id text NOT NULL,
  connection_kind text NOT NULL DEFAULT 's3' CHECK (connection_kind = 's3'),

  bucket      text NOT NULL,
  key_prefix  text NOT NULL,
  region      text NOT NULL,
  role_arn    text NOT NULL
    CHECK (role_arn ~ '^arn:aws:iam::[0-9]{12}:role/'),
  -- 🛑 MINTED BY THE DATA PLANE, NEVER SUPPLIED (G2685). A caller who chose
  --    the external id could copy another tenant's and name that tenant's
  --    role. Random, 128 bits, behind a literal prefix, and UNIQUE ACROSS
  --    TENANTS — the index is not RLS-filtered, and the only thing a
  --    collision could disclose is a value nobody can guess.
  external_id text NOT NULL CHECK (external_id ~ '^ext_[0-9a-f]{32}$'),

  PRIMARY KEY (tenant_id, endpoint_id),
  FOREIGN KEY (tenant_id, endpoint_id, connection_kind)
    REFERENCES tenant.endpoint (tenant_id, id, connection_kind)
);

CREATE UNIQUE INDEX endpoint_s3_external_id ON tenant.endpoint_s3 (external_id);


-- =====================================================================
-- §3  THE LANE — `tenant.intake_channel` GAINS A WRITER
--
-- A declared SFTP or S3 source draws down a `watched_drop` lane
-- (`SOURCE_CONNECTION_CHANNEL`, a total record). The lane is created in the
-- SAME transaction as the endpoint, so there is no committed instant at which
-- a source exists with nothing to deliver down — and `listIntakeChannels`
-- reports the lane wired from that instant.
--
-- 🛑 `INSERT` IS COLUMN-LEVEL AND `UPDATE` IS ONE COLUMN — G358's shape. The
--    request path may CREATE a lane and may SWITCH it (`enabled`, §4's stop);
--    it may not re-point one at another endpoint or change its kind. A path
--    that could re-point a lane could route a tenant's deliveries through an
--    endpoint whose credential it had just bound.
-- ⚠️ STILL NO `CHECK` AND STILL NO FOREIGN KEY — `0012` §1's decision and
--    `0270` §1a's, both unchanged: the biconditional is `guardIntakeChannel()`'s.
-- =====================================================================

GRANT INSERT (tenant_id, id, kind, endpoint_id, enabled) ON tenant.intake_channel TO tenant_rw;
GRANT UPDATE (enabled)                                   ON tenant.intake_channel TO tenant_rw;


-- =====================================================================
-- §4  `tenant.endpoint_stop_event` — THE STOP IS DATED, AND SO IS THE RESUME
--
-- Row 35: *"Disable is dated and reversible, and the deliveries stay where
-- they are."* A `disabled_at` column (the one `0270` refused) can carry a
-- date OR be reversed, never both — clearing it to resume erases WHEN it was
-- stopped. So the stop is an APPEND-ONLY event and the switch the arrival
-- cascade already reads, `intake_channel.enabled`, is flipped in the same
-- transaction by the same writer.
--
-- ⚠️ TWO FACTS ABOUT ONE THING, AND THE ONE THAT IS ENFORCED IS THE LANE.
--    `guardChannelLive()` refuses every arrival on a disabled lane, so the
--    lane IS the stop; this table is its history. `listEndpoints` derives
--    `stopped` from the lane and `stoppedAt` from this table, and
--    `tests/http/sources-served.test.ts` asserts the two agree after every act.
--
-- `SELECT, INSERT` and nothing else — `0010`'s append-only-as-a-PRIVILEGE. A
-- path that could UPDATE a stop could move WHEN a source was stopped, which
-- is the fact a period spanning the stop needs to be explicable.
-- =====================================================================

CREATE TABLE tenant.endpoint_stop_event (
  tenant_id        text        NOT NULL REFERENCES tenant.tenant (id) ON DELETE CASCADE,
  id               text        NOT NULL,
  endpoint_id      text        NOT NULL,
  -- `stopped` | `resumed`. No CHECK — `0007`'s polarity; the reader refuses.
  kind             text        NOT NULL,
  at               timestamptz NOT NULL,
  authorization_id text        NOT NULL,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, endpoint_id) REFERENCES tenant.endpoint (tenant_id, id)
);

CREATE INDEX endpoint_stop_event_by_endpoint
  ON tenant.endpoint_stop_event (tenant_id, endpoint_id, at);


-- =====================================================================
-- §5  RLS — `0001`'s predicate VERBATIM, on `USING` AND on `WITH CHECK`, on
--     all three new tables. `tenant.endpoint` keeps `0270`'s policy, which is
--     the same predicate and already governs an INSERT.
-- =====================================================================

ALTER TABLE tenant.endpoint_sftp       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_sftp       FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_s3         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_s3         FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_stop_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.endpoint_stop_event FORCE  ROW LEVEL SECURITY;

CREATE POLICY endpoint_sftp_rls ON tenant.endpoint_sftp
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY endpoint_s3_rls ON tenant.endpoint_s3
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY endpoint_stop_event_rls ON tenant.endpoint_stop_event
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));


-- =====================================================================
-- §6  GRANTS — and the one on `tenant.endpoint` is COLUMN-LEVEL
--
-- 🛑 `INSERT` ON `tenant.endpoint` NAMES SEVEN COLUMNS AND NOT THE THREE
--    BINDING COLUMNS. So a declaration CANNOT arrive carrying a credential
--    reference: the only path that writes `credential_ref` is still
--    `bindEndpointCredential`, through custody, under the tenant's key. A
--    declare that could set it could point a new source at an EXISTING
--    secret — another source's credential, reused without a bind.
--    `tests/db/source-declaration.test.ts` §2 witnesses the refusal.
-- ⚠️ STILL NO `DELETE` — *"A source that has delivered cannot be deleted"* —
--    and still no `UPDATE` on any declaration column (row 35: a change is a
--    rebinding, not an edit, and rebinding is not built).
-- =====================================================================

GRANT INSERT (tenant_id, id, label, direction, connection_kind,
              declared_at, declared_authorization_id)
  ON tenant.endpoint TO tenant_rw;

GRANT SELECT, INSERT ON tenant.endpoint_sftp       TO tenant_rw;
GRANT SELECT, INSERT ON tenant.endpoint_s3         TO tenant_rw;
GRANT SELECT, INSERT ON tenant.endpoint_stop_event TO tenant_rw;
