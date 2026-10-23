/**
 * CORRESPONDENCE'S CLOSED VOCABULARIES, NARROWED AT THE READ BOUNDARY.
 * G471's other half, 19 Sep 2026.
 *
 * ┌─ THE HOLE THIS FILLS IS `exception-vocabulary.ts`'s HOLE, ONE SURFACE OVER ┐
 * │ `db/migrations/0022_correspondence.sql` declines a CHECK constraint on     │
 * │ every vocabulary column it creates, and gives `0002_run.sql`'s reason: a   │
 * │ third copy of a closed enum *"would be a third place to drift — and the    │
 * │ one nothing checks, because no pair in the wire-mirror addresses SQL."*    │
 * │                                                                            │
 * │ That leaves the same gap `run.status`, `cause_kind` and `exception.status` │
 * │ left: NOTHING stands between an unconstrained `text` column and the wire.  │
 * │ `fast-json-stringify` SERIALISES a response, it does not validate one, so  │
 * │ an out-of-enum `trust` in the row is an out-of-enum `trust` in the body —  │
 * │ and on THIS surface that word is the one an agent prompt branches on.      │
 * │                                                                            │
 * │ So the check goes where it can be DERIVED instead of copied: here, against │
 * │ the model. Every record below is keyed `Record<Union, true>`, so a member  │
 * │ added to a model union is a `TS2741` in this file rather than a list       │
 * │ somebody forgot.                                                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 `MessageTrust` IS THE ONE TO READ, AND IT IS WHY THIS FILE IS NOT
 *    OPTIONAL. `model/correspondence.ts`: *"This is not a severity or a
 *    confidence. It is provenance, and it is the field an agent prompt must
 *    branch on: `untrusted_inbound` content is quoted as data with its
 *    provenance attached, never concatenated into instructions."* A branch on
 *    a value the union cannot name falls through every arm — and the arm it
 *    falls out of is the one that would have treated the content as hostile.
 *    **An unrecognised `trust` is refused here rather than published**, which
 *    is invariant 6 defended at the read boundary as well as at admission.
 *
 * ⚠️ A TOTAL RECORD IS TOTAL, NOT EXACT. `exception-vocabulary.ts` records the
 *    same caveat and it transfers unchanged: a record here can GAIN a key the
 *    union does not have, because a computed key raises no excess-property
 *    error. What it cannot do is LOSE one, and that is the only direction that
 *    would let an unmodelled value onto the wire.
 *
 * 🛑 `DataClass` IS DELIBERATELY NOT RE-DECLARED HERE. `isDataClass()` already
 *    exists in `exception-vocabulary.ts`, derived from `model/domain.ts`'s
 *    `DATA_CLASSES` const object, and it is IMPORTED AND RE-EXPORTED rather
 *    than rewritten — restating it would be a second copy of a list that
 *    exists (§5.3). **Do not "tidy" it into the pattern below.**
 *
 * ⚠️ AND THE MEETING-POINT NOTE APPLIES. `run-vocabulary.ts`'s opening claim —
 *    *"THE ONE PLACE `server/` MEETS `model/`"* — was already false before
 *    `engine-vocabulary.ts` existed; this file is the fifth, and the property
 *    that survives is the one that was always load-bearing: **a vocabulary is
 *    DERIVED from the model, never transcribed beside it.** Derive them:
 *    `grep -rl "from '\.\./\.\./model/" server/ | sort`
 */

import type {
  AdmissionRefusal,
  CorrespondenceChannel,
  MessageDirection,
  MessageTrust,
  ThreadStatus,
} from '../../model/correspondence.ts'
import { CORRESPONDENCE_CHANNELS } from '../../model/correspondence.ts'

export { isDataClass } from './exception-vocabulary.ts'

/**
 * `model/correspondence.ts`'s `ThreadStatus`, a BARE union with no const
 * object beside it — so unlike `CorrespondenceChannel` there is no existing
 * list to ask, and this record is the derivation rather than a copy of one.
 *
 * 🛑 THE FOUR ARE NOT A LIFECYCLE. A thread can be `answered` and then
 *    `awaiting_reply` again when the answer raises a second question, and
 *    `closed` is not terminal in any sense this table enforces. It is a
 *    membership test and nothing else.
 *
 * ⚠️ `awaiting_reply` IS THE ONE THE CONTRACT SINGLES OUT: *"`awaiting_reply`
 *    is the status that matters at close. Journey step 08: the exception stays
 *    open and visible rather than disappearing into someone's inbox."*
 */
const THREAD_STATUS: Readonly<Record<ThreadStatus, true>> = {
  open: true,
  awaiting_reply: true,
  answered: true,
  closed: true,
}

/**
 * `MessageDirection` — two arms, and the asymmetry between them is the whole
 * module. Outbound is DISCLOSURE; inbound is UNTRUSTED. Neither is the other's
 * negation and nothing here may treat the pair as a boolean.
 */
const MESSAGE_DIRECTION: Readonly<Record<MessageDirection, true>> = {
  outbound: true,
  inbound: true,
}

/**
 * 🛑 PROVENANCE. See this file's header — an unrecognised value here is an
 *    agent prompt falling out of the arm that would have quoted the content as
 *    data. Refused, never published.
 */
const MESSAGE_TRUST: Readonly<Record<MessageTrust, true>> = {
  system_generated: true,
  operator_authored: true,
  untrusted_inbound: true,
}

/**
 * `AdmissionRefusal`'s five members.
 *
 * ⚠️ THERE ARE TWO UNIONS CALLED `AdmissionRefusal` IN `model/` AND THIS IS
 *    NOT THE OTHER ONE. `model/reconciliation.ts` declares a seven-arm
 *    `AdmissionRefusal` about POPULATION admission — whether a row may enter a
 *    reconciliation — and `model/correspondence.ts` declares this five-arm one
 *    about EVIDENCE admission. They share a name, share no member, and mean
 *    different things. The import above names the file for that reason; a
 *    `from '../../model/domain.ts'` here would compile and be wrong.
 */
const ADMISSION_REFUSAL: Readonly<Record<AdmissionRefusal, true>> = {
  injection_suspected: true,
  unclassifiable: true,
  out_of_scope: true,
  malware_detected: true,
  sender_unverified: true,
}

/**
 * `ProposalActor`'s discriminator, as the wire publishes it.
 *
 * ⚠️ NOT DERIVED FROM `ProposalActor` AND IT CANNOT BE. That union's arms
 *    carry different payloads (an agent arm carries a `modelId`), and this
 *    tier publishes `{kind}` and `additionalProperties: true` — so the wire's
 *    vocabulary here is the DISCRIMINATOR ALONE and the type below says so.
 *    The column holds the discriminator and nothing else;
 *    `db/migrations/0022_correspondence.sql` §4 argues why one column carries
 *    it.
 */
const ADMITTED_BY_KIND: Readonly<Record<'user' | 'agent', true>> = {
  user: true,
  agent: true,
}

/**
 * ⚠️ `Object.hasOwn`, NEVER `in`, AND IT BINDS EVERY GUARD BELOW.
 * `'constructor' in RECORD` is `true`, so the obvious spelling admits every
 * name on `Object.prototype` — a membership test that answers yes for
 * `toString` is a membership test that lets a `toString` in a `trust` column
 * onto the wire. Copied from `exception-vocabulary.ts` deliberately: it is the
 * same three-line function and the same trap.
 */
function member(table: Readonly<Record<string, unknown>>, value: string): boolean {
  return Object.hasOwn(table, value)
}

export function isThreadStatus(v: string): v is ThreadStatus {
  return member(THREAD_STATUS, v)
}
export function isMessageDirection(v: string): v is MessageDirection {
  return member(MESSAGE_DIRECTION, v)
}
export function isMessageTrust(v: string): v is MessageTrust {
  return member(MESSAGE_TRUST, v)
}
export function isAdmissionRefusal(v: string): v is AdmissionRefusal {
  return member(ADMISSION_REFUSAL, v)
}
export function isAdmittedByKind(v: string): v is keyof typeof ADMITTED_BY_KIND {
  return member(ADMITTED_BY_KIND, v)
}

/**
 * 🛑 THE MODEL'S OWN CONST OBJECT IS THE VOCABULARY — see the header's note
 * about `DataClass`. `CORRESPONDENCE_CHANNELS` is a total const object
 * `model/correspondence.ts` already constructs and already ships, so this asks
 * its VALUE set (`CORRESPONDENCE_CHANNELS.phoneLog` is `'phone_log'`) rather
 * than restating four strings. Same treatment `exception-vocabulary.ts` gives
 * `SEVERITIES` and `DOMAIN_KEYS`, and for the same stated reason.
 */
const CHANNEL_VALUES: readonly string[] = Object.values(CORRESPONDENCE_CHANNELS)

export function isCorrespondenceChannel(v: string): v is CorrespondenceChannel {
  return CHANNEL_VALUES.includes(v)
}
