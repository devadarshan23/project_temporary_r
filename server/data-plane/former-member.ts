/**
 * IS THIS PERSON A FORMER MEMBER OF THE TENANT? — G4021, 4 Oct 2026.
 * DERIVED, NOT THE OWNER'S.
 *
 * The owner's C3-05 ruling names LIVE co-members only, quoted and never
 * paraphrased: *"Narrow name-only read: a policy letting a tenant member read
 * display_name (only) of people who share their tenant membership; widen G447's
 * directory rule for that one column."* So `tenant.co_member_name`
 * (`db/migrations/0520`) answers NULL for a person whose membership lapsed — and
 * that is the SAME null a reader holding no membership gets for everybody. Every
 * client therefore drew a lapsed approver as "a colleague" (G3886's own
 * ⚠️ *"A LAPSED MEMBER IS NOT NAMED ("a colleague")"*), which is a word that
 * asserts something the plane knows to be false.
 *
 * 🛑 THIS DOES NOT NAME ANYBODY AND DOES NOT WIDEN THE RULING. It reads
 *    `tenant.membership` alone — a table `0005` grants `tenant_rw` `SELECT` on
 *    under `0001`'s tenant predicate, which is G447's measured shape: *"a
 *    tenant can read WHO BELONGS and cannot read WHO THEY ARE."* Whether a
 *    person belongs is a fact about the tenant's own roster; no column of
 *    `tenant."user"` is read and no name crosses.
 *
 * TRUE iff the person HELD a membership in this tenant and holds NO LIVE one
 * now. The liveness terms are `holdsLiveMembership()`'s (`model/access.ts`
 * §7a) and `0520`'s, the same four, so a person the view names is never a
 * former member and the two answers cannot both hold.
 *
 * ⚠️ FALSE FOR A PERSON WHO NEVER HELD ONE — a partner acting under a grant
 *    with no membership, say. That person is not a FORMER member, and "a
 *    colleague" is not true of them either; which word they get is G4022, put
 *    to the owner rather than guessed here.
 *
 * ⚠️ THIS IS AN EIGHTH SQL SPELLING OF THE LIVENESS PREDICATE (`0035` records
 *    seven), stated once here and interpolated at every caller — the same
 *    discipline `0520`'s scalar subqueries keep — rather than once per store.
 *
 * `column` is an SQL expression naming the person (a column of the outer row);
 * it is interpolated, never bound, and only ever a literal from this repository.
 * No tenant predicate: `membership_rls` is the narrowing, as everywhere.
 */
export function formerMemberSql(column: string): string {
  return `(${column} IS NOT NULL
    AND EXISTS (SELECT 1 FROM tenant.membership fm WHERE fm.user_id = ${column})
    AND NOT EXISTS (
      SELECT 1 FROM tenant.membership lm
       WHERE lm.user_id = ${column}
         AND lm.revoked_at IS NULL
         AND (lm.expires_at IS NULL OR lm.expires_at > now())
    ))`
}
