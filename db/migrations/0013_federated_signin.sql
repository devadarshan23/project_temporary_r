-- =====================================================================
-- 0013 — THE SIGN-IN READ. G340 applied; G343 and G344 taken (19 Sep 2026).
--
-- **THE PREMISE IS A MEASURED DEADLOCK AND IT IS NOT AN ARGUMENT.**
-- `db/migrations/0009_identity_substrate.sql` reads the directory THROUGH the
-- session:
--
--     CREATE POLICY identity_connection_rls ON tenant.identity_connection
--       USING (
--         id = (
--           SELECT s.connection_id
--             FROM tenant.session s
--            WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
--         )
--       );
--
-- At the sign-in callback there is **no session**. `app.session_ref` is unset,
-- `nullif(current_setting(…), '')` is NULL, the subquery returns NULL, `id =
-- NULL` is NULL, and G100's deny-on-NULL refuses every row. **You need a
-- connection to mint a session and a session to read a connection.**
--
-- ⚠️ THE DEADLOCK IS PRESERVED AS A RUNNABLE RED RATHER THAN NARRATED.
--    `tests/db/federated-signin.test.ts` §1 opens `withSessionScope()` with a
--    digest no session row carries and requires the connection read to return
--    ZERO ROWS. It stays in the suite, so the fact this file exists to remove
--    cannot quietly stop being true. Derive the policy, do not read this quote:
--    `sed -n '/CREATE POLICY identity_connection_rls/,/;/p' db/migrations/0009_identity_substrate.sql`
--
-- RULINGS THIS APPLIES (docs/HANDOFF.md §3):
--   G340  a connection is read before a session exists through a FOURTH scoped
--         helper and a GUC — **never by relaxing `identity_connection_rls`**.
--         The three alternatives the row preserves are not re-argued here; the
--         row holds them. This file is the SECOND POLICY half; `db/signin-
--         scope.ts` is the helper half, and its header is the one that owes
--         `db/selection-scope.ts`'s bar.
--   G315  the session is minted on the TENANT host and nowhere else, so the
--         callback's reads happen on the tenant host too. Nothing in this file
--         is reachable from the regional auth host, which holds no database
--         credential of any kind.
--   G304  the broker handle is a PAIR. See G343 below: this file is where that
--         ruling becomes a POLICY PREDICATE rather than only an index.
--   G100  UNCHANGED, AND THE POINT. An unset GUC is still NULL and still
--         denies. The new policy adds a second fully-specified way IN; it
--         removes no way of being refused.
--   G101  `SET LOCAL` inside an explicit transaction, via `set_config(…, true)`.
--         The helper issues it; nothing here assumes a session-level `SET`.
--   G97   every branded id is `text`. `SignInAttemptId`, `IdentityConnectionId`
--         and `SessionHandleDigest` are all `text` and stored verbatim.
--   G88   forward-only. There is no `down`.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 G343 — THE SIGN-IN POLICY IS KEYED ON THE **PAIR**, AND G340's OWN TEXT
--    NAMES ONE GUC. THIS IS THE ONE PLACE THIS FILE DEPARTS FROM THE LETTER OF
--    THE RULING IT APPLIES, AND IT DEPARTS TOWARDS THE RULING BESIDE IT.
-- ═══════════════════════════════════════════════════════════════════════
--
-- G340 reads: *"a FOURTH scoped helper — `db/signin-scope.ts`,
-- `withSignInScope()`, setting `app.broker_ref`, with a SECOND policy on
-- `tenant.identity_connection` admitting exactly the row whose broker handle
-- the caller names."*
--
-- **`broker_ref` ALONE IS NOT A BROKER HANDLE.** G304, taken the same day and
-- one migration back, rules in as many words that it is not:
--
--     "A Cognito `ProviderName` is unique WITHIN ONE POOL and nowhere else …
--      a bare provider name is a key that can COLLIDE ACROSS POOLS, and a
--      collided handle resolves to the wrong connection → the wrong `owner` →
--      the wrong `orgClass`."
--
-- G304 priced that outcome, quoting G289: *"five controls deleted by one
-- assignment"* — the live-grant check, the `partnerId` check, revocation,
-- expiry and `PARTNER_CAPABILITY_MASK`. **A policy keyed on `broker_ref` alone
-- is that collided key in executable form, and it is worse than the column
-- G304 refused: an index enforces uniqueness at write time, whereas a policy
-- decides visibility at READ time — so a policy that matched on the reference
-- alone would admit a row from a DIFFERENT POOL to a caller who named only a
-- provider name, and `orgFor(connection.owner)` would answer about the wrong
-- organisation with nothing anywhere reporting a problem.**
--
-- 🛑 SO THE PREDICATE IS THE PAIR AND THE SCOPE CARRIES TWO GUCs. That is one
--    more moving part than the ruling names, and it is the cheaper side of the
--    trade by a wide margin: the alternative is a lookup whose correctness
--    depends on there being only one user pool in the world, which is the
--    assumption G297 spent a whole ruling deleting from the host grammar.
--
-- ⚠️ IT IS RECORDED AS A DEPARTURE RATHER THAN ABSORBED, because a reader
--    comparing G340's text to this file will see one GUC named and two set,
--    and must be able to find out in this file why — not reconstruct it.
--
-- ═══════════════════════════════════════════════════════════════════════
-- 🛑 WHAT THE SECOND POLICY DOES **NOT** DO, WHICH IS MOST OF WHAT MAKES IT
--    ACCEPTABLE.
-- ═══════════════════════════════════════════════════════════════════════
--
-- It does not make the table enumerable. A caller must already hold BOTH
-- halves of a handle to see anything, and a handle is a value the broker
-- minted; there is no prefix match, no `LIKE`, no `IS NOT NULL` arm and no
-- wildcard. G340 states the bar — *"the read is one row, named by the caller;
-- the table does not become enumerable"* — and the predicate below is
-- equality on two columns and nothing else.
--
-- It does not widen the app role's grant. 0009 granted `SELECT` on this table
-- and that is unchanged; **no serving process can write a broker handle**,
-- which is 0011's own sentence and the fence against pointing an existing
-- connection at a broker somebody controls.
--
-- It does not weaken `identity_connection_rls`. Permissive policies are OR-ed,
-- so a session-scoped caller keeps exactly the row it had and a sign-in-scoped
-- caller gets exactly the row it named. ⚠️ **A caller that set NEITHER scope
-- gets NOTHING, which is G100 unchanged**: both disjuncts are NULL, `NULL OR
-- NULL` is NULL, and NULL is not TRUE. `tests/db/federated-signin.test.ts` §2c
-- asserts that rather than reasoning about it.
--
-- 🛑 IT IS A SECOND **PERMISSIVE** POLICY AND NOT A REWRITE OF THE FIRST, AND
--    THE DIFFERENCE IS THE WHOLE OF G340's *"never by relaxing
--    `identity_connection_rls`"*. Editing the existing policy to add an `OR`
--    would put two unrelated access paths inside one expression, and the next
--    person widening one would be editing the other's predicate. 0008 already
--    took the other shape deliberately — it `ALTER POLICY`s 0005's restrictive
--    control — and the reason it was right there is the reason it is wrong
--    here: 0008's disjunct is a second way to satisfy THE SAME question
--    ("may this session select this tenant"), whereas this is a DIFFERENT
--    question ("which door is the caller standing at") asked by a caller with
--    no session at all.
-- ---------------------------------------------------------------------

CREATE POLICY identity_connection_signin_rls ON tenant.identity_connection
  USING (
    broker_issuer = nullif(current_setting('app.broker_issuer', true), '')
    AND broker_ref = nullif(current_setting('app.broker_ref', true), '')
  );


-- =====================================================================
-- `tenant.sign_in_attempt` — THE ROW THAT MAKES A CALLBACK SINGLE-USE.
--
-- `docs/contracts/session.openapi.yaml`, on `completeFederatedSignIn`:
-- *"SINGLE USE, AND THE ROW IS THE ENFORCEMENT. `consumedAt` is set in the
-- same transaction that mints the `Session`, under the row's own uniqueness,
-- so a replayed callback finds a consumed row and is refused."* **This is that
-- row.** G315 leaves the `state` nonce's storage and single-use property to
-- the builder by name — *"a replayable `state` … would hand the whole flow
-- away"* — and this is the answer: it is a row, it is addressed by a digest,
-- and it is consumed inside the transaction that reads it.
--
-- ⚠️ SEVEN COLUMNS, AND THEY ARE `SignInAttempt`'s SEVEN KEYS. Not six and not
--    eight. `model/identity.ts`'s `_SignInAttemptCarriesExactlyTheseKeys` pins
--    the model side bidirectionally, so an eighth key there is a compile error
--    and an eighth column here has nothing to be read into.
--
-- 🛑 NO `user_id` COLUMN, AND THE ABSENCE IS THE SAME CONTROL THE MODEL HOLDS
--    RATHER THAN A CONSEQUENCE OF IT. `model/domain.ts`: *"Before the door
--    answers there is no principal, and a `userId` written at redirect would
--    be a USER-EXISTENCE ORACLE on an UNAUTHENTICATED surface."*
--    `_SignInAttemptCarriesNoUserId` makes adding one to the type a compile
--    error; adding one HERE would evade that assertion entirely, which is
--    exactly why it is refused on this file's face rather than left to the
--    type to catch. **A schema is not fenced by a proof about a TypeScript
--    interface.**
--
-- ⚠️ NO `tenant_id` COLUMN EITHER, AND IT IS INVARIANT 1. A sign-in attempt
--    predates every tenant fact: `MintedSession` fixes `tenantId` to `null`
--    with a `const`, and G210 puts the selection in a later CHECK against the
--    tenant THE HOST has already bound. A tenant column here would be a
--    tenant chosen at the door, which is invariant 1 relocated to the one
--    surface that has no session to derive it from.
--
-- ⚠️ NO BROKER COLUMNS EITHER — no `broker_issuer`, no `external_subject`, no
--    claim set. That is 0004's refusal and 0006's: a column ahead of its
--    reader. The reader would be the regional auth host, which does not exist,
--    and what it would write is the output of a token verification nothing in
--    this repository performs — `grep -rn 'jwtVerify\|createRemoteJWKSet' server/`
--    returns nothing, which is G306's own derivation. **A column here would be
--    this migration deciding what a token claim set looks like, quietly, which
--    is precisely what G306 refused one file back.**
--
-- 🛑 THE CONSEQUENCE, STATED SO NOBODY HAS TO DISCOVER IT: THIS SLICE READS AND
--    CONSUMES AN ATTEMPT AND DOES NOT MINT A SESSION. A mint needs a `user_id`,
--    a `user_id` needs the subject the directory asserted, and that subject
--    arrives only from a verified token. The writer of that column lands in
--    the same commit as the verifier, with its own `GRANT` — 0009's rule,
--    verbatim: *"The commit that grants a write here owes the `WITH CHECK` in
--    the same commit as the writer."*
-- ---------------------------------------------------------------------

CREATE TABLE tenant.sign_in_attempt (
  id               text        NOT NULL PRIMARY KEY,
  -- The lookup key: the relay/`state` parameter's DIGEST, never the parameter.
  -- Same rule and same reason as `tenant.session.handle_digest` — *"a database
  -- dump containing handles would be a session-hijack kit."* UNIQUE because
  -- the policy below addresses exactly one row by it, and a policy that could
  -- match two rows is a policy that decides nothing.
  handle_digest    text        NOT NULL UNIQUE,
  -- WHICH DOOR WAS CHOSEN, PINNED AT REDIRECT. No foreign key, for the reason
  -- 0009 gives beneath `identity_connection`. Compared against the door the
  -- TOKEN came through — see G344 in `server/data-plane/signin.ts`.
  connection_id    text        NOT NULL,
  -- The IdP's own nonce or PKCE verifier, digested. COMPARED, NEVER
  -- RE-DERIVED.
  challenge_digest text        NOT NULL,
  started_at       timestamptz NOT NULL,
  -- Declared and NOT READ, and the model says so first: `consumeSignInAttempt()`
  -- *"reads no clock"* because `Timestamp = string` and a comparison in the
  -- model would be lexical. The column exists so that the codec G220 owes has
  -- something to compare when it lands, and so that a row can be expired by an
  -- operator query in the meantime. ⚠️ THERE IS NO `sign_in_attempt_expired`
  -- REFUSAL AND THE MODEL ARGUES ITS ABSENCE — do not add one here.
  expires_at       timestamptz NOT NULL,
  -- THE SINGLE-USE PROPERTY, AND THE ONLY COLUMN THE APP ROLE MAY WRITE.
  consumed_at      timestamptz
);


-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY. `ENABLE` **AND** `FORCE`, as every table in this
-- directory since 0001 — `FORCE` is what makes the OWNER subject to the policy
-- too, so a migration run as the owner cannot read past it by accident.
--
-- 🛑 THE POLICY IS KEYED ON `app.signin_ref` AND **NOT** ON `app.session_ref`,
--    THOUGH BOTH CARRY A `SessionHandleDigest`-SHAPED VALUE. Reusing the
--    session GUC would have been one fewer name and is refused on a measured
--    consequence rather than on taste: the mint that follows this read must set
--    `app.session_ref` to the digest of the **new session handle**, because
--    `session_rls`'s `WITH CHECK` compares exactly that. One GUC cannot hold
--    both values in one transaction, and **a callback split across two
--    transactions is a callback with a window between consuming the attempt and
--    minting the session** — which is the replay G315 names as the way this
--    shape is got wrong. Two names, one transaction.
--
-- ⚠️ `WITH CHECK` IS STATED RATHER THAN LEFT TO DEFAULT FROM `USING`, for
--    0005's reason on `tenant.session`: a later `FOR SELECT`/`FOR ALL` edit
--    cannot then silently drop the write half. Here it governs the `UPDATE`
--    below, and what it buys is exact — **the consuming write cannot move a
--    row out of the scope that reached it**, so `UPDATE … SET handle_digest =
--    <someone else's>` is refused by the database rather than by a reviewer.
-- ---------------------------------------------------------------------

ALTER TABLE tenant.sign_in_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant.sign_in_attempt FORCE  ROW LEVEL SECURITY;

CREATE POLICY sign_in_attempt_rls ON tenant.sign_in_attempt
  USING      (handle_digest = nullif(current_setting('app.signin_ref', true), ''))
  WITH CHECK (handle_digest = nullif(current_setting('app.signin_ref', true), ''));


-- ---------------------------------------------------------------------
-- GRANTS. By name, because 0003 declines `ALTER DEFAULT PRIVILEGES` on this
-- schema: *"A future table created here is unreachable by the app until
-- granted BY NAME."*
--
-- 🛑 `UPDATE (consumed_at)` — COLUMN-LEVEL, AND IT IS THE STRONGEST FENCE IN
--    THIS FILE. A table-level `UPDATE` would let a request path rewrite
--    `connection_id` on an attempt it can already see, which is **re-pointing a
--    pinned door from inside the callback** — the exact act
--    `SignInAttempt.connectionId` exists to make impossible: *"re-choosing at
--    callback lets a caller name a different connection than the one it was
--    sent to, and org class derives from a connection's owner. That is the ORG
--    AXIS READ FROM A REQUEST."* The model refuses it with
--    `sign_in_attempt_connection_mismatch`; this makes the refusal
--    unnecessary as well as present, which is #157's *"either alone is a
--    defeat"* with both halves in place.
--
-- 🛑 NO `INSERT`, AND IT IS A DECISION. Nothing on the request path mints a
--    sign-in attempt. The writer is the REDIRECT half — the regional auth host
--    of G315 — and it does not exist; a write privilege ahead of a writer is
--    what `0004_subject_ledger.sql` refused at length and what 0005 refused
--    again for `tenant.membership`. **The commit that builds the redirect adds
--    the privilege, in the same commit as the writer.** Until then an attempt
--    row is written by the migrator, in a test, which is the policy working
--    rather than an inconvenience.
--
-- ⚠️ NO `DELETE`. Expiry is a sweep an operator runs, not something a request
--    path may do — a caller able to delete an attempt could delete the evidence
--    that it was replayed.
-- ---------------------------------------------------------------------

GRANT SELECT               ON tenant.sign_in_attempt TO tenant_rw;
GRANT UPDATE (consumed_at) ON tenant.sign_in_attempt TO tenant_rw;
