-- 0050 — THE CONTROL PLANE SERVES THE CONSOLE'S CONTROL-OWNED FACTS ITSELF.
--
-- G4306, G4308, G4309, 5 Oct 2026, applying THE OWNER'S RULING:
--
--   "Full restore: copy the tenant name to the data plane, put onboarding
--    writes and roster reads behind signed control-plane endpoints, then
--    retire both control-DB credentials from the data plane."
--
-- This is the FIRST half of that: the privileges `0020` gave
-- `reconcile_control_reader` and `0040` gave `reconcile_control_writer` — two
-- roles whose credentials the DATA plane holds — are granted to
-- `reconcile_control_app`, the role the CONTROL plane already connects as.
-- Nothing is revoked here: the data plane still reads and writes through its
-- two roles until S3/S4 move it onto the internal operations, and the slice that
-- retires them (S5, a later migration in 0051–0059) revokes and drops both. A
-- revoke in this file would land as an outage in a process mid-flight.
--
-- 🛑 THE GRANTS ARE `0040`'s, NOT WIDER, AND THE TRIGGERS STILL BIND. `UPDATE` is
-- column-level on `completed_steps` alone; `onboarding_forced_step` takes
-- `INSERT` and nothing else; there is NO `INSERT` on `onboarding_record` (the
-- serving path may ADVANCE a delivery record and may not CREATE one) and NO
-- `DELETE` anywhere. `0040`'s advances-only trigger and `0030`'s append-only
-- triggers fire for this role exactly as for the writer — a trigger is not
-- keyed on a role.
--
-- ⚠️ INVARIANT 3 DOES NOT MOVE. Every relation here is control-owned: the
-- roster is which tenants exist (G831), the onboarding record is 1CloudHub's
-- own delivery record (G1241). The control plane reading or advancing them reads
-- no tenant's data.

-- ------------------------------------------------------------------ 1 · grants

GRANT SELECT ON onboarding_record      TO reconcile_control_app;
GRANT SELECT ON onboarding_forced_step TO reconcile_control_app;
GRANT UPDATE (completed_steps) ON onboarding_record TO reconcile_control_app;
GRANT INSERT ON onboarding_forced_step TO reconcile_control_app;
-- `tenancy_roster` SELECT is `0002`'s, unchanged.

-- ------------------------------------------------------------------ 2 · the receipt
--
-- One row per internal WRITE, keyed on the caller's idempotency key. The
-- internal signature is replayable inside STS's window (server/http/
-- internal-request.ts), and a network retry is the ordinary case, so the FIRST
-- answer is stored in the SAME transaction as the act and a repeat of the same
-- request is answered from here. The same key on a different request is a 409.
--
-- `authorisation_id` is the invariant 10 record the DATA plane minted for the
-- console act — so a control-side change names the authorisation it ran under,
-- in the database that holds the change (G4309). It is NOT a foreign key: the
-- record lives in the other database, and that is the point of two databases.
--
-- ⚠️ `response` IS `jsonb` AND THAT IS NOT `0007`'s REFUSED SHAPE. `0007` refused a
-- `jsonb` FINDINGS channel because a key with no `FieldSpec` is unreadable. This
-- is our own reply to our own caller, written by this plane, read by exactly one
-- path — the replay — and returned verbatim. No reader interprets a key in it.

CREATE TABLE internal_request_receipt (
  idempotency_key  text        NOT NULL,
  operation        text        NOT NULL,
  request_sha256   text        NOT NULL,
  authorisation_id text        NOT NULL,
  caller           text        NOT NULL,
  response         jsonb       NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idempotency_key),
  CONSTRAINT internal_request_receipt_key_shape
    CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  CONSTRAINT internal_request_receipt_authorisation_shape
    CHECK (authorisation_id ~ '^azg_[0-9a-f]{32}$'),
  CONSTRAINT internal_request_receipt_digest_shape
    CHECK (request_sha256 ~ '^[0-9a-f]{64}$')
);

-- Append-only, by trigger as well as by grant — `0030`'s argument: the grant is
-- vacuous against an admin, and a row trigger does not fire on TRUNCATE.
CREATE FUNCTION internal_request_receipt_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'public.internal_request_receipt is APPEND-ONLY: % is refused', TG_OP
    USING HINT = 'A receipt is the first answer to a request; rewriting it would let a replay '
                 'receive an answer the act never produced.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER internal_request_receipt_is_append_only
  BEFORE UPDATE OR DELETE ON internal_request_receipt
  FOR EACH ROW EXECUTE FUNCTION internal_request_receipt_append_only();
CREATE TRIGGER internal_request_receipt_is_not_truncatable
  BEFORE TRUNCATE ON internal_request_receipt
  FOR EACH STATEMENT EXECUTE FUNCTION internal_request_receipt_append_only();

GRANT SELECT, INSERT ON internal_request_receipt TO reconcile_control_app;
