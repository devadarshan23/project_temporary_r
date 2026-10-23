-- =====================================================================
-- 0280 — THE CALLBACK READS ITS DOOR OFF THE PINNED ATTEMPT, AND THE DOOR
--        CARRIES THE ONE ENDPOINT A CODE MAY BE EXCHANGED AT.
--        G2235 (owed by the callback-handler commit) and G2443 (THE OWNER'S
--        egress ruling of 1 Oct 2026), applied here. G2481–G2486.
--
-- G88: forward-only. `0009`, `0011`, `0013` and `0200` ARE NOT EDITED —
--      `0017`'s precedent. This file adds ONE column and ONE policy and
--      replaces nothing.
-- ⚠️ SCHEMA-QUALIFIED THROUGHOUT, because 0003 requires it from 0004 on.
--
-- ---------------------------------------------------------------------
-- 🛑 §1 · WHY A FOURTH POLICY ON `tenant.identity_connection` — G2235.
--
-- D6-5's debt, in D6's own words: *"The commit that writes the callback
-- handler owes an assertion that these two values are not derived from the
-- request body."* The two values are the broker PAIR `withSignInScope()` is
-- keyed on. A real callback has a `state` and a `code`; it does NOT have a
-- broker pair, and every way of obtaining one before this file reads it from
-- something the CALLER supplies — the body, a query parameter, or the token's
-- own `iss`, which D6-5 refused by name.
--
-- G2235 recorded that a pure row-derived scope was *"not expressible today
-- without a migration: no policy on `tenant.identity_connection` admits a row
-- by the pinned attempt's `connection_id`."* This is that policy. The pair
-- the mint transaction is scoped by is now READ OFF THE ROW THE REDIRECT
-- PINNED, in a transaction of its own, before the pair exists anywhere.
--
-- THE PREDICATE IS AN ADDRESS, NOT A LIST: it admits the ONE connection
-- named by the ONE attempt whose `handle_digest` equals the scope's
-- `app.signin_pin_ref`. The subquery reads `tenant.sign_in_attempt` UNDER
-- THAT TABLE'S OWN POLICIES — so the attempt must ALSO be visible through
-- `sign_in_attempt_rls` (`app.signin_ref`) and through `0240`'s RESTRICTIVE
-- expiry fence. **An expired attempt therefore pins no door**, and D6-6's
-- window governs this read without being restated here.
--
-- ⚠️ A SEPARATE GUC, `app.signin_pin_ref`, AND NOT `app.signin_ref`, AND IT
-- IS THE HALF A TIDY-UP WOULD UNDO. `withSignInScope()` sets `app.signin_ref`
-- for the MINT transaction too. Keyed on that GUC, this policy would admit
-- the pinned row INSIDE the mint transaction beside the row the broker pair
-- names — and `readConnectionByBrokerHandle()`'s `!== 1` would then answer
-- `connection_absent` for exactly the case G344 refuses as
-- `sign_in_door_disagrees`. **A tidy-up here deletes a named refusal and
-- replaces it with a wrong one.** Only `withSignInPinScope()` sets this GUC,
-- and it opens a READ ONLY transaction.
--
-- 🛑 THE RECURSION HAZARD, MEASURED AGAINST A LIVE PostgreSQL 14.18 BEFORE
-- THIS FILE WAS WRITTEN, NOT ASSUMED. `0200` recorded that a `user` policy
-- subquerying `identity_connection` recursed on eleven of eleven arms; the
-- cycle closed through `0018`'s directory policy. This policy's expansion
-- reaches `tenant.sign_in_attempt` and nothing else, and that table's two
-- policies read GUCs and the row's own columns. Measured, with the probe
-- policy installed and without:
--   pin scope, right digest .............. [idc_a]   (without: [])
--   pin scope, wrong digest .............. []
--   pin GUC alone, no `app.signin_ref` ... []        (the attempt is unread)
--   session scope, user read ............. unchanged, no recursion
--   session scope, connection read ....... unchanged
--   sign-in scope, pair names door B ..... [idc_b]   UNCHANGED — G344 intact
--   sign-in scope, user read ............. unchanged
-- `tests/db/signin-callback-pin.test.ts` keeps every arm RUNNABLE.
--
-- `FOR SELECT` AND NOTHING ELSE — G1982's lesson, `0027`'s before it: a
-- policy with no `FOR` is `FOR ALL`, and a `FOR ALL` policy with a `USING` and
-- no `WITH CHECK` reuses the `USING` as the INSERT check. The app role holds
-- `SELECT` alone here; this keeps the property when somebody grants more.
--
-- ---------------------------------------------------------------------
-- 🛑 §2 · `token_endpoint` — G2443's SECOND BOUND, AND G306's REFUSAL MET.
--
-- THE OWNER'S RULING, verbatim: *"Yes, bounded — exactly ONE file
-- (`server/data-plane/code-exchange.ts`) may POST to the PINNED connection's
-- token endpoint only, with a short timeout, outside any database
-- transaction."* **"The PINNED connection's token endpoint" names a value no
-- row carried**: `0011` refused `jwks_uri`, `audience`, `claim_map` and four
-- more BY NAME because *"a column ahead of its reader is `0004`'s refusal"*.
-- **This commit is the reader**, which is `0004`'s own condition and the one
-- `0160` met for `confidence_floor` and `0170` for `data_type`.
--
-- ⚠️ NULLABLE, AND NULL IS A REFUSAL, NOT A DEFAULT. A door with no endpoint
-- cannot complete a code exchange; the reader answers that by name rather than
-- falling back to a configured URL — a per-environment endpoint is exactly the
-- shape D6-5 refused for the issuer, and under G276's BYOA one URL is one pool.
--
-- ⚠️ NO `CHECK` ON THE SCHEME, `0069`'s POLARITY: the reader refuses anything
-- that is not `https:` (or `http:` to a LOOPBACK literal, for the local broker
-- the gate drives) — `tokenEndpointOf()` in `code-exchange.ts`. A `CHECK` here
-- would be a second statement of that rule in a second language.
--
-- 🛑 NO NEW GRANT, AND NO WRITER. `0009`'s `GRANT SELECT` covers a column
-- added later (`0011`'s precedent, witnessed there). A request path that could
-- write this column could point a door's exchange at a server it controls —
-- an SSRF primitive on the product's first public credential-minting route,
-- which is the reason G2443 names the ROW as the only source. The value
-- arrives by migrator, like every other column on this table.
-- =====================================================================

ALTER TABLE tenant.identity_connection ADD COLUMN token_endpoint text;

CREATE POLICY identity_connection_pin_rls ON tenant.identity_connection
  FOR SELECT
  USING (
    id IN (
      SELECT a.connection_id
        FROM tenant.sign_in_attempt a
       WHERE a.handle_digest = nullif(current_setting('app.signin_pin_ref', true), '')
    )
  );
