/**
 * ReconcileAI — correspondence with counterparties.
 *
 * Tenant-scoped. Data-plane resident.
 *
 * WHY THIS MODULE EXISTS
 *
 * The three-way match is arithmetic and has been solved for thirty years. The
 * labour and the cost sit in the minority of transactions that do NOT clear —
 * the chasing, the vendor email, "is this a short delivery or a pricing error",
 * the judgement on whether to accrue or reject. That loop is the product, and
 * until now the model had no vocabulary for the conversation it consists of.
 *
 * Procedure.await already names a `counterparty_reply` target and
 * EvidenceKind already names `correspondence`. Both pointed at nothing.
 *
 * THREE THINGS THIS MODULE HAS TO GET RIGHT
 *
 *   1. INBOUND IS UNTRUSTED. A vendor reply is read by an agent, which makes it
 *      the sharpest prompt-injection surface in the product. Invariant 6 —
 *      ingested content is data, never instruction — is enforced here by making
 *      a message NOT EVIDENCE until something admits it. Admission is the
 *      checkpoint; without it, "the agent read the email" and "the agent obeyed
 *      the email" are the same event.
 *
 *   2. OUTBOUND IS DISCLOSURE. Telling a vendor "invoice INV-4471 line 3: we
 *      received 90 units, you billed 100" discloses tenant data to a third
 *      party. The model already has a redaction ceiling for what reaches a model
 *      (ModelUseConfig.maxDataClassInPrompt) and for what reaches a trace
 *      (TelemetryPolicy.maxDataClassInSpanAttributes). This is the third hole of
 *      the same shape, and legally the most consequential of the three, because
 *      the recipient is outside the tenant entirely. See
 *      OutboundCorrespondenceConfig in policy.ts.
 *
 *   3. A COUNTERPARTY IS NOT A VENDOR. No domain vocabulary here: a vendor, a
 *      bank, a claimant and a candidate are all counterparties. The entity is
 *      deliberately thin — it exists so that "this counterparty has disputed
 *      freight three times before" is a query, which is the evidence that makes
 *      an agentic proposal better than a deterministic one.
 */

import type {
  CounterpartyId,
  DataClass,
  EntityStatus,
  ExceptionId,
  FieldPath,
  MessageId,
  ProcedureStepId,
  ProposalActor,
  TenantScoped,
  ThreadId,
  Timestamp,
  UserId,
} from './domain'

/* ------------------------------------------------------------------ *
 * Channels and parties
 * ------------------------------------------------------------------ */

export const CORRESPONDENCE_CHANNELS = {
  email: 'email',
  /** A supplier or bank portal, reached through a connector. */
  portal: 'portal',
  /** A human logged a call. Evidence, and never machine-parsed. */
  phoneLog: 'phone_log',
  /** A structured message over an integration rather than free text. */
  connector: 'connector',
} as const
export type CorrespondenceChannel =
  (typeof CORRESPONDENCE_CHANNELS)[keyof typeof CORRESPONDENCE_CHANNELS]

/**
 * Where a counterparty can be reached.
 *
 * `dataClass` is on the endpoint because an address is often personal data —
 * `ap-team@acme.com` is not, `priya.raman@acme.com` is, and treating them the
 * same either over-restricts every chase or leaks an individual's address into
 * a trace.
 */
export interface CounterpartyEndpoint {
  channel: CorrespondenceChannel
  address: string
  dataClass: DataClass
  /** Null until proven — an unverified address is a phishing vector outbound. */
  verifiedAt: Timestamp | null
}

/**
 * Deliberately thin, and deliberately domain-neutral.
 *
 * This is NOT a vendor master. It holds no commercial terms, no bank details,
 * no addresses beyond contact endpoints. It exists to thread a conversation and
 * to make counterparty history queryable.
 */
export interface Counterparty extends TenantScoped {
  id: CounterpartyId
  displayName: string
  /**
   * Opaque identifiers as the source systems know them — a vendor code, a bank
   * reference. Resolved from documents; never authoritative here.
   */
  externalRefs: Record<string, string>
  endpoints: CounterpartyEndpoint[]
  status: EntityStatus
}

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

export type MessageDirection = 'outbound' | 'inbound'

/**
 * Where the content came from, which decides how much it may be trusted.
 *
 * This is not a severity or a confidence. It is provenance, and it is the field
 * an agent prompt must branch on: `untrusted_inbound` content is quoted as
 * data with its provenance attached, never concatenated into instructions.
 */
export type MessageTrust =
  /** We composed it. */
  | 'system_generated'
  /** A tenant user wrote it. Trusted, and still attributable. */
  | 'operator_authored'
  /** It arrived. Treat as hostile until classified and admitted. */
  | 'untrusted_inbound'

/**
 * Why an inbound message was refused as evidence.
 *
 * A closed vocabulary, for the same reason PolicyReasonCode is: this value ends
 * up in telemetry that a restrictive SpanAttributePolicy strips everything else
 * from, and a free-text refusal reason is undiagnosable. (PolicyEvaluation.reason
 * was free text until 5 Aug and was cited here as precedent before it was one —
 * the rule was right, the citation was not.)
 */
export type AdmissionRefusal =
  /** The body attempts to instruct rather than inform. */
  | 'injection_suspected'
  | 'unclassifiable'
  | 'out_of_scope'
  | 'malware_detected'
  | 'sender_unverified'

/**
 * What was disclosed to a third party, recorded because it was.
 *
 * PDPA treats disclosure to a third party as a distinct act from collection or
 * use. An outbound chase is a disclosure, and "which fields did we send to
 * which vendor" has to be answerable without reading email bodies.
 */
export interface DisclosureRecord {
  /** Highest class actually sent. Must not exceed the policy ceiling. */
  disclosedClass: DataClass
  /** Which fields were included, so the disclosure log is queryable. */
  fieldsDisclosed: FieldPath[]
  /** The OutboundCorrespondenceConfig version in force when it went. */
  policyVersion: number
  /** Set when the class required human approval before sending. */
  approvedBy: UserId | null
}

export interface CorrespondenceMessage extends TenantScoped {
  id: MessageId
  threadId: ThreadId
  direction: MessageDirection
  channel: CorrespondenceChannel
  trust: MessageTrust

  /** The plane's record of when it left or arrived. */
  at: Timestamp

  /**
   * Pointer to the body in object storage. Bodies are CONTENT — never a column,
   * never searched, and reachable by the erasure index only through
   * SubjectLocation's blob variant.
   */
  bodyRef: string
  /**
   * Attachment blobs. These become SourceDocuments only AFTER admission —
   * an attachment from an unadmitted message must not enter extraction, which
   * is where email intake and this module meet.
   */
  attachmentRefs: string[]

  /**
   * Highest classification found in the body. Set by classification, never
   * asserted by the sender.
   */
  dataClass: DataClass

  /* --- the trust boundary --- */

  /**
   * Null means NOT EVIDENCE. An inbound message may be stored, displayed and
   * audited before admission; it may not be cited in a ResolutionProposal, fed
   * to an agent as grounds, or satisfy an `await` step.
   *
   * Always null for `untrusted_inbound` until something admits it. Outbound and
   * operator-authored messages are admitted at creation.
   */
  admittedAsEvidenceAt: Timestamp | null
  /**
   * Who admitted it. An agent may admit only where policy permits — see
   * mayAdmit() in policy.ts, which also enforces that an admitting agent step
   * carries no tools, so the agent that admits is never the agent that acts.
   */
  admittedBy: ProposalActor | null
  /**
   * Recorded at admission, not inferred later: how many tools the admitting
   * step carried. Zero is the safe value for an agent. Kept on the message so
   * an audit can check the control held at the time rather than trusting that
   * the procedure has not been edited since.
   */
  admittingToolScopeSize: number | null
  /** Set when a second person countersigned because of the message's class. */
  admissionSecondedBy: UserId | null
  /** Set instead of admission. Both null means the decision is still pending. */
  refusedFor: AdmissionRefusal | null

  /** Set on outbound only. Null inbound. */
  disclosure: DisclosureRecord | null
}

/* ------------------------------------------------------------------ *
 * Threads
 * ------------------------------------------------------------------ */

export type ThreadStatus =
  | 'open'
  /** A procedure `await` step is parked on this. */
  | 'awaiting_reply'
  | 'answered'
  | 'closed'

export interface CorrespondenceThread extends TenantScoped {
  id: ThreadId
  counterpartyId: CounterpartyId
  subject: string
  channel: CorrespondenceChannel

  /**
   * One reply can concern three invoices, and one exception can need two
   * conversations. Many-to-many, and the act of linking is a judgement — it is
   * recorded as an AuditEvent rather than inferred.
   */
  exceptionIds: ExceptionId[]

  status: ThreadStatus
  openedAt: Timestamp
  lastMessageAt: Timestamp

  /**
   * The procedure step parked on this thread, if any. Null once answered.
   *
   * This is what makes `await.counterparty_reply` executable: the step resumes
   * when a message on this thread is ADMITTED, not merely when one arrives.
   */
  awaitingStepId: ProcedureStepId | null
  /** When the parked step gives up. Mirrors the step's timeoutHours. */
  awaitDeadline: Timestamp | null
}

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

/**
 * Whether a message may be cited as evidence or resume a parked step.
 *
 * Written as a function rather than left to each call site, because "has it
 * been admitted" is the single check that separates reading a vendor email from
 * obeying one, and a call site that forgets it is the whole vulnerability.
 */
export function isAdmissible(m: CorrespondenceMessage): boolean {
  return m.admittedAsEvidenceAt !== null && m.refusedFor === null
}
