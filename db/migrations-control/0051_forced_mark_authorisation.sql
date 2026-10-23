-- 0051 — A FORCED MARK NAMES THE AUTHORISATION IT WAS WRITTEN UNDER.
--
-- G4316–G4317, 5 Oct 2026, applying THE OWNER'S "Full restore" ruling (G4301)
-- and the instruction that came with it: the onboarding writes move behind the
-- control plane's signed endpoints, and the authorisation id is recorded
-- "beside the forced mark control-side".
--
-- A forced mark is *"PERMANENT, AND THE ONLY RECORD OF WHY THE SEQUENCE WAS
-- BROKEN"*. Until now it said WHY and not UNDER WHOSE AUTHORITY: the act's
-- invariant 10 record lived in the DATA database (`tenant.
-- platform_authorization_grant`, G730) and nothing in the control database
-- pointed at it. `authorisation_id` is that pointer — the same id the internal
-- write's receipt carries (`0050`, G4309), on the row a review actually reads.
--
-- ⚠️ NULLABLE, AND NULL MEANS "BEFORE 0051". `0030`'s append-only triggers
-- refuse an UPDATE, so the existing marks cannot be backfilled and must not be:
-- inventing an id for an act whose record nobody kept would be forging the one
-- column this migration adds. Every mark written through the internal tier
-- carries one; `console-store.ts` is the only writer that does not set NULL.
--
-- ⚠️ NOT A FOREIGN KEY — the record is in the other database, which is the
-- point of two. The CHECK pins the shape `mintAuthorizationGrantId()` mints.
-- `ADD COLUMN` does not fire `0030`'s row triggers, and the existing table-level
-- `INSERT` grants cover a column added later.

ALTER TABLE onboarding_forced_step
  ADD COLUMN authorisation_id text,
  ADD CONSTRAINT onboarding_forced_step_authorisation_shape
    CHECK (authorisation_id IS NULL OR authorisation_id ~ '^azg_[0-9a-f]{32}$');
