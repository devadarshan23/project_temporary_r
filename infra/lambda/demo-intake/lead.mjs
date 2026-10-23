/**
 * ONE DEMO INTAKE, MAPPED TO ONE PipelinePulse `LeadCreate` — G3731–G3735,
 * 4 Oct 2026.
 *
 * ┌─ THE OWNER'S TWO RULINGS OF 4 Oct 2026, VERBATIM ─────────────────────────┐
 * │ AUTH:     *"You add a service token: someone on the CRM side issues a     │
 * │           long-lived service/API token for this integration and puts it   │
 * │           in the reconcile-staging-crm-lead-intake secret; build the      │
 * │           worker mapping now."*                                           │
 * │ DEFAULTS: *"Use these: motion ReconcileAI, unit Marketing Lead, SEA       │
 * │           region, status MQL, source 'reconcileai.app demo'; the rest of  │
 * │           the form goes into SDR notes."*                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE CRM IS NAMED NOW, AND IT IS NAMED BY RULING RATHER THAN BY THIS
 * FILE. `lib/config.ts` argued for a month that *"nothing in this repository
 * has ever named a CRM"*; the rulings above name one, and the wire shape is
 * transcribed from its OWN contract — `LeadCreate` in
 * `https://api.1chpipelinepulse.com/openapi.json`, read 4 Oct 2026:
 * `additionalProperties: false`, REQUIRED `company_name`, `lead_status`,
 * `business_region_id`, `gtm_motion_id`, `business_unit_id`.
 *
 * ⚠️ THE THREE IDS, THE STATUS AND THE SOURCE ARE NOT IN THIS FILE. They are
 * `DEMO_INTAKE_CRM_LEAD_DEFAULTS` in `lib/config.ts`, rendered into the
 * worker's environment by `lib/amplify-stack.ts`, and read here through
 * `readLeadDefaults()` — so a CRM-side id change is a config edit and a
 * deploy, never a code edit (the owner's instruction, G3733).
 *
 * 🛑 EVERY VALUE IS FORWARDED VERBATIM AND NONE IS INTERPRETED — INVARIANT
 * 6's SPIRIT ON A PATH THAT NEVER REACHES A MODEL: *"Ingested content is
 * data, never instruction."* A visitor's text is copied into a field or
 * into a LABELLED line of `sdr_notes`, and nothing here branches on what a
 * value SAYS — with exactly two exceptions, both about SHAPE and both
 * argued at their own sites: whether `email` is email-shaped, and whether
 * its domain is a free-mail domain. **The referral code in particular is
 * still never evaluated** (`guards.mjs`'s headline property): it rides in
 * the notes as an opaque string, and matching it to a deal is the staff
 * console's job.
 *
 * ⚠️ THIS FILE HOLDS NO AWS SDK, NO `fetch` AND NO SECRET. It is pure, so
 * `tests/infra/demo-intake.test.mjs` asserts the exact body it builds.
 */

/** The `LeadCreate.source` cap, from the CRM's own contract (`maxLength: 100`). */
export const CRM_SOURCE_MAX_LENGTH = 100

/**
 * The worker environment variables carrying the owner's defaults, keyed by
 * the `LeadCreate` field each fills.
 *
 * ⚠️ SECOND COPY. The first is `DEMO_INTAKE_CRM_LEAD_DEFAULT_ENV` in
 * `lib/config.ts`; the seam is a zip file, and the suite joins the two in
 * both directions — the shape `INTAKE_FIELDS` and the metric token use.
 */
export const LEAD_DEFAULT_ENV = {
  gtm_motion_id: 'RECONCILE_CRM_GTM_MOTION_ID',
  business_unit_id: 'RECONCILE_CRM_BUSINESS_UNIT_ID',
  business_region_id: 'RECONCILE_CRM_BUSINESS_REGION_ID',
  lead_status: 'RECONCILE_CRM_LEAD_STATUS',
  source: 'RECONCILE_CRM_LEAD_SOURCE',
}

/**
 * Read the owner's defaults out of an environment.
 *
 * ⚠️ AN UNSET OR EMPTY VARIABLE IS A REFUSAL AND NEVER A FALLBACK. All five
 * are rendered by the stack, so an absent one is a deploy defect; and
 * inventing a region or a motion here would file a real prospect under a GTM
 * line nobody chose. The refusal lands on the same `crm_not_configured` path
 * as an empty secret, so it is retried, dead-lettered and alarmed.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, defaults: Record<string, string> } | { ok: false, missing: string[] }}
 */
export function readLeadDefaults(env) {
  /** @type {Record<string, string>} */
  const defaults = {}
  const missing = []
  for (const [field, name] of Object.entries(LEAD_DEFAULT_ENV)) {
    const value = typeof env?.[name] === 'string' ? env[name].trim() : ''
    if (value === '') missing.push(name)
    else defaults[field] = value
  }
  if (missing.length === 0 && defaults.source.length > CRM_SOURCE_MAX_LENGTH) missing.push(`${LEAD_DEFAULT_ENV.source} > ${CRM_SOURCE_MAX_LENGTH}`)
  return missing.length === 0 ? { ok: true, defaults } : { ok: false, missing }
}

/**
 * Domains that name a mailbox provider rather than the sender's employer.
 *
 * ⚠️ IT IS SMALL AND DELIBERATELY NOT EXHAUSTIVE, AND A MISS COSTS LITTLE.
 * `company_domain` is OPTIONAL on `LeadCreate` and the CRM calls it a *"dedup
 * key"*: the harm this list prevents is every `gmail.com` prospect being
 * deduplicated into ONE lead. A free-mail domain it does not know becomes a
 * wrong-but-harmless dedup key on one lead; a corporate domain it wrongly
 * lists merely loses an optional field.
 */
export const FREE_MAIL_DOMAINS = [
  '163.com',
  'aol.com',
  'gmail.com',
  'gmx.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'qq.com',
  'yahoo.com',
  'yandex.com',
  'zoho.com',
]

/**
 * Whether `value` is shaped like an address the CRM's `format: email` accepts.
 *
 * ⚠️ A SHAPE TEST, NOT A VALIDATION, AND IT EXISTS FOR ONE REASON: the intake
 * accepts any string under 254 characters as `email` (every field is optional
 * and none is validated — `guards.mjs`), and `LeadCreate.email` is
 * `format: email`. Forwarding a malformed one would be a 422 that no retry
 * can cure, so a non-address is moved into the notes, verbatim and labelled,
 * rather than dropped or "fixed".
 */
export function isEmailShaped(value) {
  return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s.]+$/.test(value)
}

/**
 * The employer domain an email names, or `undefined` for a free-mail one.
 *
 * @param {string} email an email-shaped string
 */
export function companyDomainOf(email) {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  return FREE_MAIL_DOMAINS.includes(domain) ? undefined : domain
}

/**
 * The labelled lines `sdr_notes` carries, in order — "the rest of the form".
 *
 * ⚠️ THE LABELS ARE OURS AND THE VALUES ARE THE VISITOR'S, VERBATIM. A
 * multi-line `reconcilingToday` stays multi-line; nothing is trimmed beyond
 * what `readIntake()` already trimmed, and nothing is summarised.
 */
export const SDR_NOTE_LABELS = [
  ['reconcilingToday', 'What they reconcile today'],
  ['volume', 'Volume'],
  ['ownAwsAccount', 'Own AWS account'],
  ['referralCode', 'Referral code (not checked)'],
]

/** The first line of a non-empty `sdr_notes`, so a reader knows whose words follow. */
export const SDR_NOTES_PREAMBLE = 'From the reconcileai.app demo form. Visitor-typed, unverified:'

/**
 * Map one validated intake to a `LeadCreate` body.
 *
 * 🛑 A LEAD WITH NO COMPANY IS UNMAPPABLE AND IS REFUSED HERE, BEFORE THE CRM
 * IS CALLED. `company_name` is REQUIRED by `LeadCreate`, every intake field
 * is optional (`guards.mjs`), and the form's own client requires a company
 * (`frontend/site/src/Demo.tsx`) — so a company-less lead did not come from
 * the form, and inventing a company name (the email domain, a placeholder)
 * would file a prospect under an employer they never named. It is reported
 * as `lead_unmappable`, retried and dead-lettered like any other failure,
 * where a person can read the original message.
 *
 * ⚠️ KEY ORDER IS FIXED so the suite can assert the exact serialised body.
 * Optional fields are OMITTED when absent rather than sent as `null`.
 *
 * @param {Record<string, string>} intake
 * @param {Record<string, string>} defaults from `readLeadDefaults()`
 * @returns {{ ok: true, body: Record<string, string> } | { ok: false, reason: 'lead_unmappable' }}
 */
export function leadCreateFor(intake, defaults) {
  const company = intake.company
  if (typeof company !== 'string' || company === '') return { ok: false, reason: 'lead_unmappable' }

  /** @type {Record<string, string>} */
  const body = {
    company_name: company,
    lead_status: defaults.lead_status,
    business_region_id: defaults.business_region_id,
    gtm_motion_id: defaults.gtm_motion_id,
    business_unit_id: defaults.business_unit_id,
    source: defaults.source,
  }
  if (intake.name !== undefined) body.contact_name = intake.name

  const lines = []
  if (intake.email !== undefined) {
    if (isEmailShaped(intake.email)) {
      body.email = intake.email
      const domain = companyDomainOf(intake.email)
      if (domain !== undefined) body.company_domain = domain
    } else {
      lines.push(`Email (as typed, not an address): ${intake.email}`)
    }
  }
  for (const [field, label] of SDR_NOTE_LABELS) {
    if (intake[field] !== undefined) lines.push(`${label}: ${intake[field]}`)
  }
  if (lines.length > 0) body.sdr_notes = [SDR_NOTES_PREAMBLE, ...lines].join('\n')
  return { ok: true, body }
}
