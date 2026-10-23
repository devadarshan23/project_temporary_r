/**
 * THE SUBJECT DIGEST — the one place a subject's natural identifier becomes the
 * token `tenant.subject_index_entry.subject_ref` stores. G321, 19 Sep 2026.
 *
 * ─── WHY IT IS HERE AND NOT IN `model/` ───
 *
 * `model/canonical.ts` states the division in its own voice: *"IT DOES NOT
 * HASH. It returns the canonical STRING and stops. Hashing needs
 * `node:crypto`, and `model/tsconfig.json` is standalone — no `package.json`,
 * no `node_modules`, no `extends` … The hasher lives with the writer, outside
 * `model/`."* `0004_subject_ledger.sql` records the same split for its own
 * digest. This is that hasher, and it is ONE function for G111's reason:
 * correctness that lives at call sites is correctness that drifts.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G321 — THIS IS NOT `SubjectKeyScheme`'s HMAC, AND THE DIFFERENCE IS
 *    STATED HERE RATHER THAN DISCOVERED BY WHOEVER QUOTES THIS FILE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `model/governance.ts` declares `SubjectKeyScheme`: `hmac_sha256` under a
 * per-tenant `keyRef`, *"the salt never leaves the tenant's region"*, and *"No
 * field in this model may hold key material."* **There is no key store in this
 * repository.** No KMS client, no secret manager, and G290's key-minting lambda
 * mints bucket keys and is not reachable from here.
 *
 * WHAT THIS DOES: HMAC-SHA256 keyed on the TENANT ID, over
 * `canonicalise()`'s RFC 8785 form of the value.
 *
 *   ✅ CROSS-TENANT CORRELATION IS DEFEATED, which is the failure
 *      `SubjectIndexEntry` names in its own docblock: *"A global key would turn
 *      the privacy index itself into a cross-tenant correlation surface —
 *      exactly the failure this design exists to prevent."* The same person in
 *      two tenants produces two unrelated tokens.
 *   ❌ A GUESSING ATTACK IS NOT DEFEATED. The key is the tenant id and a tenant
 *      id is not secret, so a holder of the table can test a candidate
 *      identifier against it. A real key would stop that. **Do not describe
 *      this column as an HMAC under `SubjectKeyScheme`, in a document, a
 *      comment or a review.**
 *
 * ⚠️ IT SHIPS RATHER THAN BLOCKS BECAUSE THE ALTERNATIVE AVAILABLE TODAY IS
 *    WORSE AND `0004` ALREADY WEIGHED IT: the alternative is *"a permanent
 *    plaintext index of every identifier every counterparty ever sent"*, on a
 *    table whose retention is `tenant_lifetime`. The upgrade is a new column
 *    and a re-index under G88, owed to whoever lands the key store.
 *
 * ⚠️ AND A SECOND PROPERTY IT DOES NOT HAVE, SO NOBODY READS ONE INTO IT: a
 *    digest is NOT reversible and there is no lookup from token to value. That
 *    is the point — `0004` accepts the identical cost, *"the ledger alone can
 *    no longer show WHICH prior invoice collided — only that one did"* — and it
 *    means an erasure request must arrive carrying the identifier, which is how
 *    a data-subject request arrives anyway.
 *
 * ─── WHAT IT REFUSES, AND WHY A REFUSAL RATHER THAN A FALLBACK ───
 *
 * `canonicalise()` refuses a non-finite number, an unsupported type and a
 * cycle. A digest over "whatever `JSON.stringify` did with it" would make two
 * different values collide or one value produce two tokens depending on how it
 * was built — and a subject index that sometimes misses is an erasure plan that
 * reports success. So a refusal propagates and the WRITER declines to register
 * rather than registering something weaker. `server/data-plane/payload-store.ts`
 * turns that into a named outcome; it never falls back.
 */

import { createHmac } from 'node:crypto'

import { canonicalise } from '../../model/canonical.ts'

/**
 * Why a value could not become a subject token. Carries NO VALUE and no key —
 * a refusal is the thing most likely to reach a log line, and the value is
 * counterparty text of the most sensitive kind this file will ever touch.
 * `CanonicalisationRefusal` carries a JSON-Pointer `path` for the caller's
 * benefit and is deliberately NOT propagated for that reason.
 */
export type SubjectDigestRefusal = { readonly kind: 'value_not_canonicalisable' }

export type SubjectDigest =
  | { readonly ok: true; readonly ref: string }
  | { readonly ok: false; readonly refusal: SubjectDigestRefusal }

/**
 * The one seam.
 *
 * ⚠️ THE TENANT ID IS THE HMAC KEY AND NOT A PREFIX ON THE MESSAGE, AND THE
 * DIFFERENCE IS NOT COSMETIC. `sha256(tenantId + value)` is a length-extension
 * construction and, worse here, it is ambiguous across the boundary: tenant
 * `ten_a` with value `bc` and tenant `ten_ab` with value `c` hash the same
 * bytes. HMAC's key/message separation removes both, and the ambiguity is the
 * one that would actually bite — it is a CROSS-TENANT collision in the one
 * table whose whole purpose is that tenants do not correlate.
 */
export function subjectDigest(tenantId: string, value: unknown): SubjectDigest {
  const canonical = canonicalise(value)
  if (!canonical.ok) return { ok: false, refusal: { kind: 'value_not_canonicalisable' } }
  return {
    ok: true,
    ref: createHmac('sha256', tenantId).update(canonical.json, 'utf8').digest('hex'),
  }
}
