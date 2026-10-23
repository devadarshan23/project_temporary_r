-- =====================================================================
-- CONTROL PLANE 0001 — THE PACK CATALOGUE.
--
-- 🛑 A SEPARATE MIGRATION SET FOR A SEPARATE DATABASE, AND THE SEPARATION IS
--    THE FEATURE. Ruling 3, 16 Aug 2026: "two processes, two databases,
--    compose — the plane boundary is enforced by TOPOLOGY, not by review."
--    Invariant 3 — "the control plane publishes downward and never reads tenant
--    data" — is a thing the control plane CANNOT do here, because there is no
--    `tenant` table in this database, no `tenant_contact`, no `run`, and no
--    credential in the control plane's configuration that reaches the database
--    where those live.
--
-- ⚠️ THERE IS NO ROW-LEVEL SECURITY IN THIS FILE, AND THAT IS NOT AN OMISSION.
--    RLS exists to keep one tenant's rows away from another tenant's session.
--    Nothing in this database is tenant-scoped: a pack catalogue is
--    PLATFORM-AUTHORED content, published downward to every plane entitled to
--    it. `control-plane.openapi.yaml` says so of the two fields this table
--    exposes — "`label` and `domain` are ours — platform-authored catalogue
--    content, not customer-authored — so they are safe to return."
--
--    Adding an empty policy here would be worse than adding none: it would make
--    a reader believe this database has a tenant boundary to enforce, and the
--    day somebody puts a tenant-scoped table in it, the absence of a policy on
--    THAT table would look like the existing pattern.
--
-- G88 applies unchanged: forward-only, never edited once applied.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PACK_CATALOGUE — mirrors `PackSummary` in control-plane.openapi.yaml
-- (`components.schemas.PackSummary`), one column per property:
--
--   packKey               -> pack_key
--   packVersion           -> pack_version         (composite PK with pack_key)
--   label                 -> label
--   domain                -> domain
--   lifecycle             -> lifecycle            eight states, every
--                                                 transition gated; a plane
--                                                 only ever sees the last three
--   minimumSchemaVersion  -> minimum_schema_version
--                                                 "The filter that makes
--                                                 'listed' and 'installable'
--                                                 the same set."
--   supersededBy          -> superseded_by        nullable; set when deprecated
-- ---------------------------------------------------------------------

CREATE TABLE pack_catalogue (
  pack_key               text    NOT NULL,
  pack_version           integer NOT NULL,
  label                  text    NOT NULL,
  domain                 text    NOT NULL,
  lifecycle              text    NOT NULL,
  minimum_schema_version integer NOT NULL,
  superseded_by          text,

  PRIMARY KEY (pack_key, pack_version)
);

-- `listEntitledPacks` filters on the caller's declared schema version:
-- "the listing is filtered against the caller's declared `X-Schema-Version`
-- and the supported version window, so a plane never sees a pack version it
-- cannot load."
CREATE INDEX pack_catalogue_loadable_idx ON pack_catalogue (minimum_schema_version);


-- ---------------------------------------------------------------------
-- GRANTS. The control plane's application role READS and does nothing else.
--
-- The catalogue is written by the pack-authoring pipeline (X1), which is not
-- this process and is not built. SELECT is therefore the whole grant, and a
-- serving process that cannot write the thing it serves is one fewer way for a
-- published artefact to change under a plane that is pulling it.
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO reconcile_control_app;
GRANT SELECT ON pack_catalogue TO reconcile_control_app;
