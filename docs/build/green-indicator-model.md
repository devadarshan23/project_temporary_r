# Green team — the indicator model: what `design/close-twomarks.html` asserts and `model/` cannot yet produce

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — a green-team input. It proposes shapes; it decides nothing.
> **Its shapes were adjudicated in G74, and G74 is NOT APPLIED** — `docs/HANDOFF.md` §0a lists its four creates (whose-move, human attribution, `TokenForecast`, `EndpointHealth`) as the third thing to do, after the trim sign-off. None of them exists in `model/`. Read `docs/build/red-indicator-model.md` beside it: two of the five surface claims it addresses were ruled **unbuildable as designed**.
> *Banner added 8 Aug 2026. Body left as written.*

> 🟡 **A PROPOSAL. NOTHING HERE IS APPLIED.** No file in `model/`,
> `docs/contracts/` or `design/` is changed by this document. Written 8 August
> 2026 against **G49–G71** (`docs/HANDOFF.md` §3, all taken 7 Aug), the v1 trim
> ruling (`docs/HANDOFF.md` §0), `docs/v1-trim-proposal.md` (itself unapplied),
> and `docs/build/green-reconciliation-slices.md` R2 and R5, which this document
> extends rather than restates.
>
> **Every claim about `model/` carries `file:line`.** Every gap is marked
> **DERIVATION** (follows from something already decided) or **DECISION**
> (somebody must choose). Line numbers are at `HEAD` on 8 Aug 2026; §8 records
> the stale citations found while writing this, per house practice.

---

## 0. The method — what "done" means for a proposal of this shape

`CLAUDE.md` requires *"done"* to be defined before code. For four of the five
items below the honest definition is **not** a green `tsc`, and saying so is part
of the deliverable:

| Evidence | Strength here | Why |
|---|---|---|
| `npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit` → `EXIT: 0` | ⚠️ **weak** | Types only. Four of the five proposals below **cannot fail to compile** — `CLAUDE.md`, "Writing model code", and `docs/HANDOFF.md` §5.10 |
| A **mapped-type absence assertion** in the `AssertNotExceptionAnchored` family (`model/domain.ts:3732-3737`) | 🟢 **strong for absences** | It is the only artefact in this repository that makes *adding a field* a compile error. Three of the five proposals below turn on an absence, and this is why they are checkable at all |
| A **fixture** in `model/examples.ts` that CONSTRUCTS the shape | 🟢 **strong for content** | The only artefact that witnesses a *value*. §5.10: five total records landed 7 Aug with no construction site |
| A grep over `model/*.ts` | strong for absences, weak for presence | The only mechanical check on "derived, never stored" |
| `node tools/planner/extract.mjs` — edges **by kind** | medium | Blind to union members, non-id-shaped fields, drop notes. Two of the four fields branded on 7 Aug were invisible to it (`CLAUDE.md`) |

**Every proposal below names its assertion or its fixture. That is the "done"
definition.** Where neither is available I say so instead of substituting a
green run.

---

## 1. The five assertions, and the verdict on each

The direction contract is the first HTML comment of `design/close-twomarks.html`
(lines 1–18). Two of its clauses are load-bearing on the model and are quoted
where they bite:

> **FORM: Human and Spend — name the person, not the agent; price the machine in
> tokens, never in money.**

| # | The surface asserts | Verdict | New stored fields |
|---|---|---|---|
| **I1** | A five-term standing vocabulary — `closed · needs authority · no recourse · below floor · waiting` | **DERIVATION** + one new derived vocabulary. **Not** a re-key of `ExceptionStatus`, **not** a field | **0** |
| **I2** | Whose move it is — *yours* vs *still happening elsewhere* | **DERIVATION**, in two steps, one of which is viewer-relative and must reuse `decide()` | **0** |
| **I3** | Human-in-the-loop attribution per finding, agent never named | **DERIVATION** over `AuditEvent` + **one CREATE**: `CorrespondenceMessage` records no author | **1** |
| **I4** | A per-action token forecast — *"about ~2.4k tokens"*, before the act | **CREATE.** Nothing in the model estimates. Must not touch `Money`, must not touch `UsageRecord` | 2 types, **0** on existing rows |
| **I5** | Connection liveness — *"ERP live · read 08:04"*, *"Bank feed unreachable since 03:15"* | **CREATE**, smallest form: one tenant-scoped rollup row + one pure function. `Endpoint` carries no liveness at all | **1 new entity** |

---

## 2. The finding that governs I1, I2 and I3 — the register's rows are not all `Exception`s

**Read this before the individual proposals; three of them are wrong without it.**

The six register rows in `design/close-twomarks.html:301-340` have **four
different subjects**:

| Row | Surface text | The model row underneath | Evidence |
|---|---|---|---|
| **A** | *"Matched on all three legs · 1,806 lines"* → `Cleared` | `MatchGroup` with `outcome: 'matched'` | `model/domain.ts:2579`, `:2586`. **No `Exception` is raised for a matched group** |
| **B.1** | *"Invoice exceeds PO price"* → `needs authority` | `Exception` + `ResolutionProposal` | `:2750`, `:3225` |
| **B.2** | *"within tolerance ±2 units, v4 · no one was asked"* → `Cleared within tolerance` | `Exception` with `resolution.mode = 'autonomous'` | `:2669-2683` |
| **C** | *"Missing leg · receipt absent"* → `no recourse`, *"Nothing to match against"* | `MatchGroup` with `outcome: 'unmatched'` — *"'unmatched' is where an orphan belongs — **never an Exception with a null explanation**"* | `:2585-2586`, verbatim |
| **D** | *"Could not read · 3 dockets"*, meter at 61% under a 90% floor → `below floor` | `SourceDocument` fields whose `Provenance.confidence` is under `FieldSpec.confidenceFloor` | `:1655`, `:1605`. **`SourceDocument` has no status field at all** (`:1681-1704`) |
| **E** | *"Duplicate invoice"*, *"AP notified · awaiting credit note"* → `waiting` | `Exception` resolved to a **non-terminal** disposition, and/or a `CorrespondenceThread` at `awaiting_reply` | `Disposition.terminal` `:1896`; `ThreadStatus` `model/correspondence.ts:230-234` |

**Three consequences, and they decide the shape of I1–I3:**

1. **A field on `Exception` cannot carry the standing**, because two of six rows
   are not exceptions. Adding one would also make
   `{ status: 'resolved', standing: 'below_floor' }` typecheck — `docs/HANDOFF.md`
   §5.5 exactly, an invalid state made legal by the type meant to prevent it.
2. **Re-keying `ExceptionStatus` (`model/domain.ts:489`, seven members) is worse
   than useless.** It is lossy in one direction (`rejected` and `dismissed` both
   land on `closed`) and too poor in the other (`waiting` needs disposition
   terminality and thread status, neither of which `ExceptionStatus` can see).
   It is also referenced by `model/presentation.ts:576,880` and pinned by the
   queue; widening or re-keying a closed union is a platform release, and
   deriving is not.
3. **`docs/HANDOFF.md` §5.3 is the governing risk** — two vocabularies for one
   concept, diverging, *"within hours"* in every recorded instance. The only
   structural mitigation available is that the five surface terms must be a
   **function of** the model's state, computed in exactly one place, and **never
   stored beside it**. That is the design of I1 and it is why I1's verification is
   an absence assertion rather than a fixture.

---

## I1 — the five-term standing vocabulary

### Verdict

**DERIVATION.** Create one closed vocabulary and one total function. **Change no
existing union. Add no field to any row.**

### The change — `model/domain.ts`, immediately after `ExceptionStatus` (`:489`)

Placed adjacent to `ExceptionStatus` deliberately: §5.3's tell is *"the same noun
appearing in two modules with two spellings of its value set"*, and adjacency is
the cheapest structural mitigation this repository has. A reader who edits one
sees the other.

```ts
/**
 * WHAT A REGISTER ROW IS WAITING ON, IN THE READER'S WORDS. DERIVED, NEVER
 * STORED — `_ExceptionCarriesNoStanding` and its two siblings make storing it a
 * compile error.
 *
 * NOT A RE-KEY OF `ExceptionStatus` and not reachable from it alone: two of the
 * six rows this vocabulary describes are not exceptions (a matched `MatchGroup`
 * and a `SourceDocument` under its confidence floor), and two `ExceptionStatus`
 * members collapse onto one term here. This is a READER'S vocabulary over a
 * heterogeneous set of subjects; `ExceptionStatus` is a state machine over one.
 */
export const FINDING_STANDINGS = {
  /** Nothing remains to be done. The surface renders this as grey ink and no word. */
  closed: 'closed',
  /** The next move requires a person's authority. */
  needsAuthority: 'needs_authority',
  /** No next move exists for anybody. The one standing that should alarm someone. */
  noRecourse: 'no_recourse',
  /** A machine reading fell under the floor declared on `FieldSpec.confidenceFloor`. */
  belowFloor: 'below_floor',
  /** An outside party owes the next move, and the model can name what is owed. */
  waiting: 'waiting',
} as const
export type FindingStanding =
  (typeof FINDING_STANDINGS)[keyof typeof FINDING_STANDINGS]

/**
 * The facts `standingFor()` needs, and nothing it could get from a request.
 *
 * A DISCRIMINATED UNION OVER WHAT A ROW IS, not a flat record, for the reason
 * `ExceptionResolution` is one (`domain.ts:2669`): a flat record makes
 * `{ kind: exception, fieldsBelowFloor: 3 }` a legal value of the type written
 * to prevent it.
 *
 * FACTS, NOT OBJECTS, and deliberately: `awaitingCounterpartyReply` is resolved
 * from `CorrespondenceThread.status` in `correspondence.ts`, which imports this
 * module. Taking the thread here would invert the dependency.
 *
 * ⚠️ §5.2 — every member below is a fact the callee CANNOT compute from what it
 * holds. If a later edit adds one it could, delete the parameter instead.
 */
export type FindingBasis =
  | { kind: 'match_group'; outcome: MatchGroupOutcome }
  | {
      kind: 'exception'
      status: ExceptionStatus
      /**
       * Terminality of the disposition the resolution landed on. Null while
       * unresolved. `Disposition.terminal` (`:1896`): *"False routes to another
       * procedure rather than closing the exception"* — which IS waiting.
       */
      resolvedDispositionIsTerminal: boolean | null
      /** True iff a thread linked to this exception sits at `awaiting_reply`. */
      awaitingCounterpartyReply: boolean
    }
  | { kind: 'extraction'; fieldsBelowFloor: number }

/** Extracted from the inline union on `MatchGroup.outcome` (`:2586`). */
export type MatchGroupOutcome = 'matched' | 'exception' | 'unmatched'

export function standingFor(basis: FindingBasis): FindingStanding { … }
```

### The rules, each keyed on the property and not on a landmark (§5.1)

| Basis | Standing | Keyed on |
|---|---|---|
| `match_group`, `matched` | `closed` | the outcome |
| `match_group`, `unmatched` | `no_recourse` | *"an orphan … never an Exception"* (`:2585`). **There is literally nothing to match against, which is the surface's own caption** |
| `match_group`, `exception` | — | not a row; the `Exception` is |
| `extraction`, `fieldsBelowFloor > 0` | `below_floor` | `Provenance.confidence` vs `FieldSpec.confidenceFloor` |
| `exception`, `resolved` + terminal | `closed` | terminality, not status |
| `exception`, `resolved` + **non-terminal** | `waiting` | terminality — a non-terminal disposition **names what is awaited** (`awaiting_grn`, `model/examples.ts:336`) |
| `exception`, `rejected` \| `dismissed` | `closed` | terminal states |
| `exception`, `pending_approval` \| `resolution_proposed` | `needs_authority` | a decision exists and only a person may take it |
| `exception`, `open` \| `investigating` + awaiting reply | `waiting` | the thread, not the status |
| `exception`, `open` \| `investigating`, not awaiting | `needs_authority` | see the DECISION below |

⚠️ **DECISION — the untouched exception.** The five terms have no word for *"open,
nobody has looked, choices remain."* I recommend `needs_authority` and **not** a
sixth member, under G55 (*fewer knobs*): on the surface "needs authority" already
covers *"you approve"* and *"you classify"*, so the word means "a person's
authority is the next move", not "an approver's". The counter-argument is real —
it dilutes the term that B.1 uses for a drafted, balanced journal awaiting a
signature. **Record the choice; do not let it be inferred.**

⚠️ **DECISION — the strong reading of `no_recourse` is not computable today.** The
richer definition — *an open exception where every disposition the archetype
allows has been tried and rejected* — needs a stored record of rejected
dispositions, and there is none: `Disposition[]` lives on the pack
(`SolutionPack.dispositions`, `model/examples.ts:336-341`), families are gated by
archetype (`DISPOSITION_FAMILIES`, `:1853`), and nothing records exhaustion.
**Ship the orphan-only reading; record that widening it needs a new stored fact.**

### Which existing types this touches

`ExceptionStatus` (`:489`) — **read, unchanged**. `MatchGroup.outcome` (`:2586`) —
extracted to a named alias, **same members**. `Disposition.terminal` (`:1896`),
`FieldSpec.confidenceFloor` (`:1605`), `Provenance.confidence` (`:1655`),
`CorrespondenceThread.status` (`correspondence.ts:250`) — all **read, unchanged**.
`model/presentation.ts:576,880` consume `ExceptionStatus` and are unaffected
because it does not move.

### Invariant obligations

| Invariant | Obligation |
|---|---|
| **1 — tenant scope from the session** | `standingFor()` is pure over facts and touches no tenant id. The *assembly* of a `FindingBasis` is a `tenant_data` read and is gated as one (`view_exception`, `view_document` → `tenant_data`, `model/access.ts:517`) |
| **4 — classification declared once** | The standing is derived from `FieldSpec.confidenceFloor` and `Disposition.terminal`, both declared once. It **must not** re-derive severity: `Exception.severity`/`severityRank` (`:2767`,`:2778`) are the band, and the standing is not a second severity |
| **5 — money is always derived** | `FindingStanding` carries no `Money` and must not gain one. `Exception.valueAtRisk` (`:2780`) is a separate cell on the surface and stays separate |

### Verification — this is the "done" definition

1. **The absence assertion, which is the real control.** Reuse the
   `AssertNotExceptionAnchored` pattern verbatim (`model/domain.ts:3732-3737`):

   ```ts
   type CarriesNoStanding<M> = {
     [K in keyof M]: K extends 'standing' | 'turn' | 'addressee' ? never : M[K]
   }
   export type AssertStandingIsNotStored<M extends CarriesNoStanding<M>> = M
   export type _ExceptionCarriesNoStanding      = AssertStandingIsNotStored<Exception>
   export type _MatchGroupCarriesNoStanding     = AssertStandingIsNotStored<MatchGroup>
   export type _SourceDocumentCarriesNoStanding = AssertStandingIsNotStored<SourceDocument>
   ```

   **Verify RED and revert**, per the house discipline: add
   `standing: FindingStanding` to `Exception` and confirm the error is
   `TS2344 … Types of property 'standing' are incompatible. Type
   'FindingStanding' is not assignable to type 'never'`, **and that it is the
   only error** — a `TS6133`/`TS6196` alongside means `noUnusedLocals` produced
   the red, which `model/domain.ts:3700-3702` records slice 5 falling into.
2. **Fixture** in `model/examples.ts`: one `FindingBasis` per arm, six values,
   asserting the six register rows produce `closed · needs_authority ·
   no_recourse · below_floor · closed · waiting` **in that order**. Nothing in
   `model/` constructs an `Exception` today (`docs/build/green-reconciliation-slices.md`
   §0), so this fixture is the first thing that witnesses any of it.
3. **Derived, never stored:**
   ```bash
   grep -rnE '^\s+(standing|addressee|turn)\s*\??:' model/*.ts   # expect 0
   ```
4. **The union stayed closed:**
   ```bash
   awk '/^export type ExceptionStatus =/,/^$/' model/domain.ts | grep -c "^  | '"   # expect 7
   ```

---

## I2 — whose move it is

### Verdict

**DERIVATION, in two steps.** The surface's four `data-turn` values
(`design/close-twomarks.html:117-138`) collapse **two different questions**, and
separating them is the whole proposal.

- `done`, `none` and `world` are properties of the **standing**. They are the
  same for every viewer.
- `you` is **viewer-relative** and cannot be a property of the row. The headline
  *"5 of 14 need you"* (`:266`) is a per-viewer count.

### The change — `model/domain.ts`, immediately after `FINDING_STANDINGS`

```ts
/** WHO OWES THE NEXT MOVE. A property of the standing; the same for every viewer. */
export const FINDING_ADDRESSEES = {
  /** Somebody inside the tenant, holding a capability, in scope. */
  aPerson: 'a_person',
  /** An outside party, and the model can name what is owed. */
  theWorld: 'the_world',
  /** Nobody — the work is finished. */
  noOne: 'no_one',
  /** Nobody, and that is the problem. */
  noOneAvailable: 'no_one_available',
} as const
export type FindingAddressee =
  (typeof FINDING_ADDRESSEES)[keyof typeof FINDING_ADDRESSEES]

/** Total over `FindingStanding`: an unclassified standing is a compile error. */
export const STANDING_ADDRESSEE: Record<FindingStanding, FindingAddressee> = {
  closed:          'no_one',
  needs_authority: 'a_person',
  below_floor:     'a_person',
  waiting:         'the_world',
  no_recourse:     'no_one_available',
}
```

⚠️ **§5.10 applies to that total record and the note belongs at the declaration:**
nothing in `model/` constructs a `FindingAddressee`, so the compiler confirms the
record is *total* and never confirms any *content*. The fixture in I1 step 2 is
what witnesses it — one fixture covers both.

Then the viewer step:

```ts
/** WHOSE MOVE IT IS, from here. Viewer-relative; never stored. */
export type FindingTurn =
  /** Yours. The surface draws a caret. */
  | 'yours'
  /** A person's, and not yours. THE SURFACE HAS NO MARK FOR THIS AND NEEDS ONE. */
  | 'someone_elses'
  /** Outside. The surface draws an ellipsis. */
  | 'elsewhere'
  /** Finished. The surface recedes the row to grey. */
  | 'settled'
  /** Nobody's. The surface prints the word and no cue. */
  | 'nobodys'

/**
 * ⚠️ TAKES A `Decision`, NEVER A BOOLEAN, AND THAT IS THE ENTIRE SAFETY
 * ARGUMENT. `docs/HANDOFF.md` §5.2 — "a caller-supplied parameter that switches a
 * check off". A `viewerMayAct: boolean` parameter here would let any caller pass
 * `true` and make every row read "your move", and the caller with the strongest
 * motive to pass one is the one rendering a queue it wants to look busy.
 *
 * `Decision` (`model/access.ts:1080`) is minted only by `decide()` (`:1128`) and
 * carries its scope with it — "SCOPE TRAVELS WITH THE ANSWER. Never beside it."
 * This function re-derives NOTHING about capability or scope.
 */
export function turnFor(
  addressee: FindingAddressee,
  decision: Decision,
  assignedToViewer: boolean,
): FindingTurn { … }
```

Rules: `no_one → settled`; `the_world → elsewhere`; `no_one_available → nobodys`;
`a_person → decision.allowed && (assignedToViewer || assignedTo === null) ?
'yours' : 'someone_elses'`.

### Which existing types this touches

`Decision` (`model/access.ts:1080`) and `decide()` (`:1128`) — **called, not
modified**. `Exception.assignedTo` (`:2835`) — **read**; it is the field that
narrows "a person" to "this person", and it exists. `domain.ts` already imports
from `./access` (`model/domain.ts:29`), so the `Decision` import adds no new
module edge.

### Invariant obligations

| Invariant | Obligation |
|---|---|
| **1** | The viewer is a `PrincipalContext` whose `tenantId` and `orgClass` are *"DERIVED SERVER-SIDE at session establishment"* (`model/access.ts:947-953`). `turnFor()` must never accept a viewer id from a payload |
| **2 / 8** | A `partner_admin` viewer's `Decision` comes from the same `decide()`, so a partner never gets `yours`. Under **G51** no partner user signs in at all in v1, so this is declared-and-unexercised — say so, do not claim it is enforced |
| **10** | Computing a turn is a read, not an act, and mints no `AuthorizationGrant`. The underlying `view_exception` read is a `DataAccessEvent` on the existing path |

### Verification

1. **The `boolean` regression is the one to guard.** Grep, and it is cheap:
   ```bash
   grep -nE 'function turnFor\(' -A6 model/domain.ts | grep -c 'boolean'   # expect 1 — assignedToViewer only
   ```
   A second `boolean` is the §5.2 shape arriving.
2. **Fixture:** the same six-row fixture, evaluated under **two** viewers — one
   holding `approve_resolution` in scope, one not. Row B.1 must read `yours` for
   the first and `someone_elses` for the second. **That pair is the proof the
   headline count is viewer-scoped**, and it is the only mechanical evidence
   available that `turnFor` is not a constant.
3. **Totality:** delete a key from `STANDING_ADDRESSEE`, confirm `TS2739`
   (missing property), revert.

### ⚠️ Two consequences for the surface and the contract

- **`someone_elses` has no mark in `design/close-twomarks.html`.** The design
  contract says *"Every other state is a word ending in a character that says
  whose move it is"* (`:3-4`) and enumerates three characters (`:120-122`). A
  person's move that is not yours is a fourth state and currently renders
  identically to *yours*. **DECISION for the design team, not engineering.**
- **The headline count is not cacheable across viewers.** `5 of 14 need you` is
  `count(turn === 'yours')`. Any contract operation returning it must be scoped
  per principal, which rules out a shared cache key. **DERIVATION** — but it has
  to be said before somebody caches it.

---

## I3 — human-in-the-loop attribution per finding

### Verdict

**DERIVATION for the past act, over `AuditEvent` — plus ONE CREATE**, because the
model cannot say who wrote an outbound message.

### The problem the surface hides in one visual slot

`design/close-twomarks.html` prints **four different facts** through `.hu`
(`:168-173`):

| Surface | Fact | In the model |
|---|---|---|
| *"A. Cruz chased the vendor 07 Mar"* (`:322`) | the **last human act**, past | ⚠️ **not recordable** — see the CREATE below |
| *"AP notified"* (`:336`) | a **party notified**, past — and *AP* is a group, not a `UserId` | `TenantContact` (`:792`), *"an address with a duty attached. It authorises nothing"* (`:760`) |
| *"you approve"* / *"you classify"* (`:308`,`:329`) | the **awaited** human act, future | This is I2's `turnFor()` plus the capability that would be exercised. **A different fact and it must not share a field** |
| *"no one was asked"* (`:315`) | the **absence**, which is the design thesis | Derives to `null` |

⚠️ **§5.3 hazard, named before it happens.** One slot, four facts. If a
`humanNote: string` or a `lastHumanActor: UserId` is minted to fill it, it becomes
a fifth vocabulary beside `ExceptionResolution.executedBy` (`:2691`,`:2699`),
`ApprovalDecision.decidedBy` (`:3261`), `ExceptionReversal.reversedBy` (`:2741`)
and `AuditEvent.actor` (`:3774`) — and every recorded instance of this shape
diverged *within hours*. **No free-text field, and no fifth actor field.**

### The CREATE — `model/correspondence.ts`, on `CorrespondenceMessage` (`:164`)

```ts
/**
 * WHO WROTE IT. Set on outbound and operator-authored messages; null inbound.
 *
 * ⚠️ THIS WAS NOT RECORDABLE. `admittedBy` (`:209`) is the closest field and it
 * is the WRONG FACT OVERLOADED: `:201` says "Outbound and operator-authored
 * messages are admitted at creation", so today authorship is INFERRED from
 * admission. That is `docs/HANDOFF.md` §5.1 exactly — a rule keyed on a
 * convenient landmark (admission) instead of the property it cares about
 * (authorship) — and it fails the moment an agent drafts a chase a person sends,
 * or a person admits a draft somebody else wrote.
 *
 * `ProposalActor` (`domain.ts:3185`), NOT `UserId`, and this is the design
 * contract at the type: the agent may author a chase, and when it does the
 * surface prints NO NAME. A `UserId` would make an agent-authored message
 * unrepresentable, and the fix somebody would reach for is a nullable name —
 * which loses the distinction between "the agent wrote it" and "we do not know".
 */
authoredBy: ProposalActor | null
```

### The DERIVATION — `model/domain.ts`, beside `AuditEvent` (`:3744`)

```ts
/**
 * THE LAST HUMAN ACT ON A FINDING. Derived from `AuditEvent`, never stored.
 *
 * `null` is the product's thesis in the type system: the agent ran every row, so
 * naming it says nothing, and a finding no person touched reads "no one was
 * asked" rather than naming the machine. A `HumanTouch` is minted ONLY from an
 * `AuditEvent` whose `actor.kind === 'user'` — `agent`, `system`,
 * `partner_staff` and `platform_staff` all derive to null, and the last two
 * deliberately: a support read is not a finance judgement and must not appear
 * where one belongs.
 */
export interface HumanTouch {
  userId: UserId
  /**
   * ⚠️ THE CAPABILITY EXERCISED, NEVER `AuditEvent.action`. That field is a bare
   * `string` (`:3794`) and `docs/build/green-reconciliation-slices.md` R2
   * already records that "a bare string cannot make it distinct".
   * `Capability` (`model/access.ts:464`) is a 36-member CLOSED set, it is what
   * the `AuthorizationGrant` on the same row was minted against, and it needs no
   * new vocabulary — which is the §5.3 mitigation, not a convenience.
   */
  capability: Capability
  at: Timestamp
}

export function humanTouchFor(
  events: readonly AuditEvent[],
): HumanTouch | null { … }
```

### Which existing types this touches

`AuditEvent.actor` / `.authorizationId` / `.at` (`:3774`, `:3793`, `:3808`) —
**read**. `AuditActor` (`governance.ts:886`) — **read**; its `user` variant
already carries `orgClass` and `assignmentId`. `ProposalActor` (`:3185`) —
**reused, unchanged**. `ApprovalDecision` (`:3250`) — **reused, unchanged**; it is
a *decision* record, not an attribution projection, and merging them would be
§5.3.

### The join, and its one weakness

`AuditEvent.subjectType`/`subjectId` are **bare by rule** (`:3795`, `:3805`,
listed in `BareByRule`, `model/identity.ts:842`) — *"an audit row names a row of
ANY type, so no single brand is correct here"*. So the join from a finding to its
human acts is a `(subjectType, subjectId)` pair with no type safety, and for row
C it is a **two-hop** join: the chase is subject-typed on the
`CorrespondenceMessage`, and reaching the exception goes through
`CorrespondenceThread.exceptionIds` (`correspondence.ts:248`). ⚠️ **DERIVATION,
but record it:** `tools/planner/extract.mjs` cannot see either hop, so nothing in
this repository will notice if the join breaks.

### Invariant obligations

| Invariant | Obligation |
|---|---|
| **10 — an act with no authorisation is unrecordable** | `HumanTouch` is minted only from an `AuditEvent` carrying a non-null `authorizationId`. `AUTHORIZATION_MAY_BE_ABSENT` (`governance.ts:1124`) permits null for `system` only, and a `system` actor never produces a `HumanTouch` — so the two rules agree by construction rather than by comment |
| **6 — ingested content is data, never instruction** | `HumanTouch` carries **no text**. It cannot, and must not gain a `note` field: an attribution line rendered from counterparty-derived text is an injection surface on the front door. Compare `_CarriedTurnHoldsNoText` (`model/identity.ts:1189`) |
| **4** | The rendered display name is a `User` read under the viewer's own scope, never denormalised onto the finding |

### Verification

1. **No fifth actor field.** Adding one to `Exception` must be red. Extend I1's
   assertion key set:
   ```ts
   type CarriesNoStanding<M> = {
     [K in keyof M]: K extends
       'standing' | 'turn' | 'addressee' | 'humanTouch' | 'lastHumanActor' | 'humanNote'
       ? never : M[K]
   }
   ```
   Verify RED with `humanNote: string` on `Exception`, revert.
2. **`HumanTouch` holds no text** — and ⚠️ **the obvious proof does not compile,
   which is worth knowing before somebody spends an hour on it.**
   `AssertNoPlainText` (`model/identity.ts:1142`) is
   `{ [K in keyof T]: string extends T[K] ? never : T[K] }`, and
   `Timestamp = string` (`model/kernel.ts:422`) is a naked alias — so
   `AssertNoPlainText<HumanTouch>` fails on `at: Timestamp`, not on any text
   field. **This is G47's own finding recurring:** the proof rejected `askedAt`
   for exactly this reason and the field was dropped rather than the alias fixed
   (`docs/HANDOFF.md` §3, G47). Until `Timestamp` is branded — a recorded
   separate sweep — the check here is a grep, and it is weaker:
   ```bash
   awk '/^export interface HumanTouch/,/^\}/' model/domain.ts | grep -cE ':\s*string\b'   # expect 0
   ```
   **Do not drop `at` to make an assertion pass.** That would be trading a real
   field for a proof of the wrong thing.
3. **Fixture:** two `AuditEvent`s on one exception — one `{kind:'agent'}`, one
   `{kind:'user'}` — and assert `humanTouchFor` returns the user's. Then a
   single-event agent-only case returning `null`. **That null is row B.2's *"no
   one was asked"*, and it is the only mechanical evidence the thesis holds.**
4. **The author gap closes:**
   ```bash
   awk '/^export interface CorrespondenceMessage/,/^\}/' model/correspondence.ts \
     | grep -c 'authoredBy'    # expect 1 after the change, 0 today
   ```

⚠️ **DECISION — *"AP notified"*.** A `TenantContact` is *"an address with a duty
attached"* (`:760`) and has no `UserId`. Either `HumanTouch` gains a second arm
for a notified party — making it a union, which is honest — or the surface stops
printing group notifications in the person slot. **Recommend the union**, because
the fact is real and the alternative is that the model quietly loses it.

---

## I4 — the per-action token forecast

### Verdict

**CREATE.** Nothing in `model/` estimates anything, and the absence is total:

```bash
grep -rc 'forecast' model/*.ts | grep -v ':0'    # no output — ZERO occurrences, any case
grep -rin 'estimate' model/*.ts                  # ONE hit: model/deployment.ts:251, in a
                                                 # dropped module, about cost figures
```

No estimator, no estimate type, no basis, no confidence. `Budget`
(`model/billing.ts:382`) is the nearest thing and it is a **ceiling on what has
been spent**, not a projection of what an act would spend.

The surface asserts *"re-runs the match, about **~2.4k** tokens"* (`:340`) **on a
button, before the act**. `TokenUsage` (`:2475`) and `UsageRecord`
(`billing.ts:122`) both record what **was** spent.

### The three constraints that decide the shape

1. **Invariant 5 — money is always derived; `UsageRecord` is immutable and
   unpriced.** A forecast must carry **no `Money` field, ever**, and must not be
   a `UsageRecord`: it is not a fact, it did not happen, and `UsageRecord` is
   append-only and ships to the control plane. It also cannot be a `Meter`:
   `METERS` (`billing.ts:75`) is eight members of things that *happened*.
2. **`metering` is a resource class with no write mode** (`CLAUDE.md`,
   invariant 5). A forecast is computed at read time for an act a viewer might
   take — it is a `tenant_data` read, not metering.
3. **The design contract forbids money outright** — *"price the machine in
   tokens, never in money"* (`:16`), and `PRODUCT.md` forbids inventing a price.

### The change — `model/domain.ts`, immediately after `TokenUsage` (`:2475`)

Adjacency again, and for the sharper reason this time: the forecast and the fact
must split tokens the **same way** or the comparison that closes the loop is
meaningless. Putting them in one screen is what makes a divergence visible.

```ts
/**
 * WHAT AN ACTION WOULD SPEND, IN TOKENS. An estimate; never a fact, never priced.
 *
 * A UNION AND NOT A NUMBER, because the three states a surface must distinguish
 * are not distinguishable in a number. `0` reads as "free", and a free act and an
 * unknown act are opposite claims — `docs/HANDOFF.md` §5.5, an invalid state made
 * legal. `none` is what makes "your reading spends nothing"
 * (`design/close-twomarks.html:333`) a TYPED CLAIM rather than an absent number,
 * and that sentence is the argument the whole feature makes.
 *
 * 🛑 NO `Money` FIELD, AND ONE MUST NEVER BE ADDED. Invariant 5 —
 * `_TokenForecastIsUnpriced` turns that into a compile error, and `PRODUCT.md`
 * has no price to convert with in any case.
 */
export type TokenForecast =
  /** The action reaches no model. The DEFAULT for a human confirming a figure. */
  | { kind: 'none'; because: 'no_model_call' }
  | { kind: 'estimated'; estimate: TokenEstimate }
  /** We cannot say. A surface shows NO NUMBER — never a zero, never a guess. */
  | { kind: 'unknown'; because: ForecastUnknownReason }

export interface TokenEstimate {
  /**
   * A BAND, NOT A POINT. `p50` is what a surface renders with its tilde; `p90` is
   * what a ceiling must be tested against, because testing a ceiling against a
   * median approves half the population by construction.
   */
  p50InputTokens: number
  p50OutputTokens: number
  p90InputTokens: number
  p90OutputTokens: number
  /**
   * BRANDED, and this is invariant 7, not tidiness. A forecast naming a model by
   * an unresolvable string cannot be checked against the residency policy in
   * force. `CLAUDE.md` records TWO live bypasses already
   * (`UsageRecord.model`, `PolicySubject.model_call.model`); this must not be a
   * third. Same argument as `TokenUsage.model` (`:2491`).
   */
  model: ModelCatalogEntryId
  basis: ForecastBasis
  computedAt: Timestamp
}

/**
 * HOW CONFIDENT, AND IT IS THE PROVENANCE RATHER THAN A PERCENTAGE.
 *
 * A bare `confidence: number` on an estimate is `docs/HANDOFF.md` §5.6 — a
 * control that passes while asserting nothing — because nothing in this
 * repository would compute it. The sample size and its window ARE the confidence,
 * and a reader can argue with them.
 */
export type ForecastBasis =
  /** Measured from this tenant's own completed runs. The only strong arm. */
  | { kind: 'observed'; sampleSize: number; windowDays: number }
  /** Declared by the pack for an action with no local history yet. */
  | { kind: 'declared'; packId: SolutionPackId; packVersion: number }

export type ForecastUnknownReason =
  /** Fewer observations than the publication floor, and no pack declaration. */
  | 'sample_too_thin'
  /** The action's model is not resolvable — invariant 7 refuses to guess. */
  | 'model_unresolved'
```

### Sub-question (a) — how confident is the estimate

Answered structurally, twice over: the **band** (`p50`/`p90`) carries the spread,
and `ForecastBasis` carries where the number came from. The `unknown` arm carries
the case where neither is good enough. ⚠️ **DECISION: the publication floor** —
below how many observations does an `observed` basis become `sample_too_thin`?
Recommend it be a **constant in `model/`**, not per-tenant configuration (G55,
fewer knobs), and that it be named rather than inlined, because a threshold
inlined at a call site is `docs/HANDOFF.md` §5.2 waiting to happen.

### Sub-question (b) — what happens when the actual overruns

**Recommendation: nothing stops, and the variance is recorded.** The reasoning,
and it is the same in both directions:

- **A forecast must not become a ceiling.** Ceilings already exist and are typed:
  `AutonomyConfig.autoResolveValueCeiling` (`policy.ts:137`),
  `AssignmentScope.valueCeiling` (`access.ts:673`), `PackPosture.costCeilingPerRun`
  (`model/examples.ts:310`). Adding a fourth gate keyed on an *estimate* is a
  control that fires on a guess — and the caller who wants the act to proceed is
  the caller who supplies the estimate. §5.2.
- **But an unrecorded miss is worse**, because the `observed` basis then never
  improves and the number on the button drifts silently. So:

```ts
/**
 * ONE FORECAST, MEASURED AFTER THE FACT. Append-only; the loop that makes an
 * `observed` basis honest.
 *
 * ⚠️ IT IS NOT A `UsageRecord` AND MUST NOT BECOME ONE. `UsageRecord` ships to
 * the control plane and is safe to ship precisely because it is "PII-free BY
 * CONSTRUCTION" (`billing.ts:160-164`). This row stays in the DATA plane: it is
 * the tenant's own calibration record and the control plane has no use for it.
 */
export interface TokenForecastOutcome extends TenantScoped {
  id: TokenForecastOutcomeId          // new brand in kernel.ts
  /** The estimate as it was shown. Kept verbatim — a re-derived forecast proves nothing. */
  forecast: TokenEstimate
  /** What actually happened. The same split, deliberately. */
  actual: TokenUsage
  runId: RunId | null
  /** INVARIANT 10. Non-nullable — somebody took the action this measures. */
  authorizationId: AuthorizationGrantId
  at: Timestamp
}
```

⚠️ **DECISION — what the surface does on a large miss.** Recommend: an overrun
above the `p90` band **does not block and does not warn on the row**; it moves the
next forecast for that action to `unknown` until the sample recovers. A surface
that stops showing a number it cannot stand behind is more honest than one that
shows a number with a warning beside it — and it needs no new state.

### ⚠️ The unresolved sub-item: what `action` a forecast is keyed on

`TokenForecast` above deliberately carries **no action key**, because there is no
closed vocabulary of forecastable actions and inventing one is exactly §5.3.
Candidates and why each fails:

| Candidate | Where | Why it does not fit |
|---|---|---|
| `ToolKey` (`:436-463`) | closed, `TOOL_EFFECT` total | The surface's forecasted act is *"Reopen — re-runs the match"*, which is a **run**, not a tool call |
| `AgentAction` (`:466-483`) | closed | Names what an agent does, not what a button offers |
| `Capability` (`access.ts:464`) | closed, 36 members | 🟢 **The best fit.** Every offered button is already gated on exactly one capability, and `trigger_run` is the one row E's Reopen needs |

**Recommendation: key the forecast on `Capability`, attached to the offered
action in the row projection, not stored on `TokenForecast` itself.** A capability
is already the currency of what a viewer may do, I2 already resolves one per row
to compute `yours`, and it mints no sixth vocabulary. **DECISION** — record it.

### Invariant obligations

| Invariant | Obligation |
|---|---|
| **5 — money is derived; `UsageRecord` is immutable and unpriced** | No `Money` on any type above; `TokenForecastOutcome` is not a `UsageRecord`, is not a `Meter`, and does not ship |
| **7 — residency survives inference** | `TokenEstimate.model` is `ModelCatalogEntryId`. A bare string here would be a **sixth** bypass on top of the two `CLAUDE.md` already records as live |
| **10** | `TokenForecastOutcome.authorizationId` non-nullable, matching `EndpointReading.authorizationId` (`:3414`) and `OperatorProposalDecision.authorizationId` (`:3646`) and for the same argument |
| **1** | `TokenForecastOutcome extends TenantScoped`; no `tenantId` in any request body |

### Verification

1. **Unpriced, as a compile error** — this is the strong one:
   ```ts
   type CarriesNoMoney<M> = {
     [K in keyof M]: [Extract<M[K], Money>] extends [never] ? M[K] : never
   }
   export type AssertUnpriced<M extends CarriesNoMoney<M>> = M
   export type _TokenEstimateIsUnpriced = AssertUnpriced<TokenEstimate>
   export type _TokenForecastOutcomeIsUnpriced = AssertUnpriced<TokenForecastOutcome>
   ```
   **Verify RED** by adding `estimatedCost: Money` to `TokenEstimate`; confirm
   `TS2344` and that it is the only error; revert.
2. **No meter is minted for a forecast:**
   ```bash
   awk '/^export const METERS = \{/,/^\} as const/' model/billing.ts | grep -ci forecast   # expect 0
   grep -rn 'TokenForecast' model/billing.ts                                              # expect 0
   ```
3. **Fixture:** three `TokenForecast` values — one per arm. The `none` arm must be
   the one attached to `confirm_extraction` (R2's proposed 37th capability), which
   is the type-level form of *"your reading spends nothing"*.
4. **The band is not a point:** a fixture where `p90 > p50` and a second where they
   are equal (a deterministic action) — both legal, and the surface must render
   the first with a tilde.
5. `TokenForecastOutcomeId` registers in **three** `model/identity.ts` proofs —
   `_BrandArgumentsNameTheirEntities` (`:213`),
   `_EntitiesCarryTheirOwnIdentity` (`:502`) and
   `_NoIdShapedReferenceIsABareString` (`:945`). Omitting any is a compile
   error, which is the one place the compiler genuinely helps on this proposal.
   The same three apply to `EndpointHealthId` in I5.

---

## I5 — connection liveness

### Verdict

**CREATE, in the smallest honest form.** `Endpoint` (`:595-644`) carries **no
liveness**: `id`, `label`, `direction`, `address`, `credentialRef` (`:622`),
`verifiedAt` (`:628`), `verificationExpiresAt`, `writebackEnabled` (`:636`),
`boundUntil` (`:642`), `disabledAt` (`:643`). Verification is an **authority**
fact, not a reachability one — *"Verification is the control, not hygiene"*
(`:624-627`) — and `disabledAt` is a deliberate act. Neither answers *"read
08:04"* or *"unreachable since 03:15"*.

### Why the two obvious answers are wrong

- **`deployment.ts` has the right shape and is the wrong object.**
  `DATA_PLANE_LIVENESS` (`:88-98`, with an `unreachable` member) and
  `livenessFor(secondsSinceLastBeat)` (`:417-424`) are precisely the pattern —
  and the whole module is `@dropped-for-v1` under **G36**, and it models *our*
  fleet, not a customer's ERP. Importing from a dropped module to build a live v1
  surface would make G36 un-reversible in the wrong direction. **Copy the shape,
  cite the precedent, do not import.**
- **Deriving from `EndpointReading` (`:3368`) does not work, and the reason is the
  finding.** It has `endpointId` (`:3379`) and `readAt` (`:3403`), so
  `MAX(readAt)` gives *"read 08:04"* exactly — but it records only **successful**
  reads on the operator-proposal path. **Absence of a reading is not evidence of
  unreachability**; it is indistinguishable from nobody having asked. The same
  lesson `CLAUDE.md` records about the extractor: *its silence is NOT evidence of
  absence*. So the smallest addition is a record of the **attempt**, not the
  success.

### The change — `model/domain.ts`, immediately after `Endpoint` (`:644`)

```ts
/**
 * WHAT THE CHANNEL SAYS, never what the workload says — the distinction
 * `deployment.ts:80` draws for data planes, borrowed rather than reinvented.
 *
 * ⚠️ `unknown` IS MANDATORY AND IS NOT A PLACEHOLDER. Without it a
 * freshly-configured endpoint is either `unreachable` (the surface cries wolf on
 * every new connection) or `live` (it fails OPEN, which is the polarity
 * `docs/HANDOFF.md` §5.5 records `AssignmentScope` getting backwards). Nobody
 * having tried is a third answer and the type must be able to give it.
 */
export const ENDPOINT_LIVENESS = {
  live: 'live',
  /** Reached, but the last attempt failed and an earlier one succeeded. */
  degraded: 'degraded',
  unreachable: 'unreachable',
  /** No attempt on record. NOT a synonym for unreachable. */
  unknown: 'unknown',
} as const
export type EndpointLiveness =
  (typeof ENDPOINT_LIVENESS)[keyof typeof ENDPOINT_LIVENESS]

/**
 * ONE ROLLUP ROW PER ENDPOINT. Not a time series and not a field on `Endpoint`.
 *
 * ⚠️ WHY NOT FIELDS ON `Endpoint`. `Endpoint` is `endpoint`-class and mutated by
 * `configure_endpoint` (`model/access.ts:548`). Writing reachability through that
 * row means a machine mutates a configuration record continuously, and an audit
 * of `configure_endpoint` — the capability that governs where the platform
 * reaches — fills with liveness noise. The act of configuring and the fact of
 * reaching are different acts with different actors, and one row cannot carry
 * both without the audit becoming unreadable.
 *
 * ⚠️ COUNTS ATTEMPTS SOMEBODY AUTHORISED, AND NOTHING ELSE. There is no health
 * poll in this design, deliberately: `EndpointReading.authorizationId` is
 * non-nullable because "reaching a customer's ERP on a credential is never a
 * system act with nobody behind it" (`:3405-3413`), and a five-minute liveness
 * poll on a customer credential is exactly that act. So "unreachable since
 * 03:15" means THE LAST AUTHORISED ATTEMPT, AT 03:15, FAILED — which is a
 * stronger claim than a poll makes, and needs no new authorisation shape.
 */
export interface EndpointHealth extends TenantScoped {
  id: EndpointHealthId                 // new brand in kernel.ts
  endpointId: EndpointId
  lastAttemptAt: Timestamp | null
  lastSuccessAt: Timestamp | null
  lastFailureAt: Timestamp | null
  /** Reset to 0 on any success. The only counter, and it is what `degraded` reads. */
  consecutiveFailures: number
  /**
   * ⚠️ A CLASS, NEVER THE FOREIGN SYSTEM'S MESSAGE. Invariant 6 — a remote
   * error string is ingested content, and rendering it on the front door is an
   * injection surface on the one screen everybody opens.
   */
  lastFailureClass: EndpointFailureClass | null
}

export type EndpointFailureClass =
  | 'unreachable'        // no answer at all
  | 'credential_refused' // reached, refused — a `bind_secret` problem, not a network one
  | 'timeout'
  | 'malformed_response'

/** Pure, and takes elapsed seconds rather than a clock — `deployment.ts:410-415`. */
export function endpointLivenessFor(
  secondsSinceLastSuccess: number | null,
  consecutiveFailures: number,
): EndpointLiveness { … }
```

### Which existing types this touches

`Endpoint` (`:595`) — **unchanged**; `EndpointId` (`kernel.ts:349`) is already
branded. `EndpointReading` (`:3368`) — **unchanged**; it remains the record of
*what was read*, and `EndpointHealth` is the record of *whether we got through*.
`DATA_PLANE_LIVENESS` / `livenessFor()` (`deployment.ts:88`, `:417`) — **cited as
precedent, not imported** (dropped under G36).

### Invariant obligations

| Invariant | Obligation |
|---|---|
| **1** | `EndpointHealth extends TenantScoped`. A customer's ERP reachability is that customer's data |
| **3 — the control plane publishes downward and never reads tenant data** | 🛑 **The sharp one.** `EndpointHealth` **must not ship**. It is not a `UsageRecord` and carries no `sequence`, no `shippedAt`. ⚠️ **G59 puts source and connection configuration with the FDE**, so an FDE debugging a dead bank feed reaches this row — and that reach is a `TenantAccessGrant` under `PERMITTED_RESOURCES.delivery` (`governance.ts:401`), **not** a control-plane read |
| **8 — being staff is not access** | Reading `EndpointHealth` needs `endpoint` in the grant's resource set. `endpoint` is already a class (`governance.ts:141` block) and `configure_endpoint` already maps to it (`access.ts:548`). ⚠️ **DECISION: is there a read capability?** There is no `view_endpoint`. Today the only way to read an endpoint is to hold the capability that *configures* one — read implied by write, which is the shape §5.6 catalogues. **Recommend minting `view_endpoint` → `endpoint` alongside this**, and note that `CAPABILITY_RESOURCE_CLASS` (`access.ts:517`) is a `Record<Capability, …>`, so the compiler forces the classification |
| **10** | The attempt that produced the row ran under an `AuthorizationGrant` by construction — see the no-poll argument above |

### Verification

1. **`unknown` is reachable, and that is the whole point:**
   ```ts
   // fixture — a configured endpoint nobody has used
   const fresh: EndpointHealth = { …, lastAttemptAt: null, consecutiveFailures: 0, … }
   // endpointLivenessFor(null, 0) === 'unknown', NOT 'unreachable'
   ```
   This is the fixture that would have caught the polarity bug §5.5 records.
2. **No foreign text on the row** — same limitation as I3 step 2 and for the same
   reason: `AssertNoPlainText` cannot be used here because `EndpointHealth`
   carries three `Timestamp`s and `Timestamp = string` (`model/kernel.ts:422`).
   The check is a grep until the `Timestamp` branding sweep lands:
   ```bash
   awk '/^export interface EndpointHealth/,/^\}/' model/domain.ts | grep -cE ':\s*string\b'   # expect 0
   ```
   ⚠️ **This is the weakest verification in this document**, and the field it
   guards — a remote error message on the front door — is the one with the
   sharpest invariant-6 consequence. Say so; do not present the grep as a proof.
3. **It does not ship:**
   ```bash
   awk '/^export interface EndpointHealth/,/^\}/' model/domain.ts \
     | grep -cE 'sequence|shippedAt|dataPlaneId'      # expect 0
   ```
4. **Capability totality:** add `view_endpoint` to `CAPABILITIES` (`access.ts:251`)
   **without** adding it to `CAPABILITY_RESOURCE_CLASS` (`:517`); confirm the
   typecheck fails; revert. Then note the count moves **36 → 37** — or **38** with
   R2's `confirm_extraction` — and that `CLAUDE.md` says *count the array, do not
   trust the line* (§5.11).
5. **Extractor delta:** `EndpointHealth.endpointId` is id-shaped, so
   `node tools/planner/extract.mjs` should report **+1 node, +1 resolving edge, 0
   dangling**. Compare against `571e7c26`'s 136 nodes / 242 edges, per `CLAUDE.md`.

---

## 6. The three biggest risks

**R-A · The five terms become a stored column within a month, and then diverge.**
This is `docs/HANDOFF.md` §5.3's shape and every recorded instance diverged within
hours of being duplicated. The pressure is real and specific: a queue that sorts
by standing wants an index, and an index wants a column. **The mitigation is the
absence assertion in I1 step 1, and it is the single most important line in this
document.** Without it, "derived, never stored" is a comment, and §5.3 records
what comments are worth against this pressure.

**R-B · The forecast is the least-considered item and it invites two failures at
once.** (i) A number on a button is a commitment a reader will treat as a price
even though it is in tokens — and a *point* estimate makes that worse, which is
why the band and the `unknown` arm are non-negotiable. (ii) The pull to gate on
it is strong and it is §5.2: an estimate used as a ceiling is a control whose
input the acting party supplies. **Nothing here should gate. If a later decision
makes it gate, that is a DECISION and it must be written down as reversing this
recommendation.**

**R-C · Four of the five proposals cannot fail to compile, and one of them adds a
total record with no construction site.** `STANDING_ADDRESSEE` is the sixth
instance of `docs/HANDOFF.md` §5.10 if it lands without a fixture. **The whole
verification value of this document rests on one fixtures pass in
`model/examples.ts`** — which does not currently construct an `Exception`, a
`SourceDocument`, a `ResolutionProposal` or an `OperatorProposal`. A green `tsc`
after applying any of this tells you nothing, and a report that says otherwise is
the defect, not the evidence.

---

## 7. Unresolved — carried forward, marked

| # | Item | Kind | Owner |
|---|---|---|---|
| U1 | The five terms have no word for *open, untouched, choices remain*. Recommended: fold into `needs_authority`; do not mint a sixth | **DECISION** | product owner |
| U2 | `no_recourse` ships as orphan-only. The strong reading needs a stored record of rejected dispositions, which does not exist | **DECISION** | engineering, then owner |
| U3 | `someone_elses` has **no mark** in `design/close-twomarks.html`; a person's move that is not yours renders identically to yours | **DECISION** | design |
| U4 | *"AP notified"* names a `TenantContact`, not a `UserId`. `HumanTouch` becomes a union, or the surface stops printing it | **DECISION** | product owner |
| U5 | What a forecast is **keyed on**. Recommended: `Capability`, on the offered action, not on the forecast | **DECISION** | engineering |
| U6 | The publication floor below which an `observed` basis becomes `sample_too_thin` | **DECISION** | product owner |
| U7 | No `view_endpoint` capability exists — reading an endpoint currently implies holding the capability that configures one (§5.6 shape) | **DERIVATION**, but it mints a capability, which is a platform release | engineering |
| U8 | The finding→`AuditEvent` join is `(subjectType, subjectId)`, both bare by rule (`identity.ts:842`), two hops for a correspondence act. No tool here can see it break | **accepted risk**, recorded | — |
| U9 | Invariant 2 stays declared-and-unexercised through all five (G51) — no partner user signs in, so no partner ever computes a `turn` | recorded, not resolved | — |
| U10 | ⚠️ **`AssertNoPlainText` cannot be applied to any type carrying a `Timestamp`**, because `Timestamp = string` (`model/kernel.ts:422`) is a naked alias. This blocks the strongest available proof on **both** `HumanTouch` (I3) and `EndpointHealth` (I5), and it is G47's finding recurring on two new types rather than one. The `Timestamp` branding sweep is already recorded and unowned | **DERIVATION**, blocked on a recorded sweep | engineering |

**Sequencing.** I1 → I2 → I3 (I2 needs I1's vocabulary; I3's future-act half is
I2's output). **I4 and I5 are independent of all three and of each other.** I5 is
the smallest and the only one whose verification is genuinely strong today.

---

## 8. Stale citations found while writing this

Recorded rather than quietly fixed, per `docs/HANDOFF.md` §6.

1. **`design/close-twomarks.html:154-155`** cites *"build-conventions §6.7"* for
   the rule that a light meaning *"your ERP is unreachable"* may not be a colour
   alone. §6.7 is **"Icon-only controls need names"** (`docs/build-conventions.md:208`).
   The rule quoted is **§6.1**, *"The status dot is decoration. The status word is
   the truth"* (`:148`), whose closing line is *"Every status must survive
   greyscale."* The design's implementation is correct; the pointer is not.
2. **`CLAUDE.md`** cites `CAPABILITY_RESOURCE_CLASS` at `model/access.ts:426` and
   `ACCESS_RESOURCE_CLASSES` at `model/governance.ts:113`. They are at
   **`access.ts:517`** and **`governance.ts:141`**. Counts derived fresh on 8 Aug:
   **36** capabilities, **13** resource classes — both correct as stated.
3. **`docs/HANDOFF.md` §3** header says *"Forty-FOUR decisions"* and *"APPLIED:
   eighteen of seventy-one"* in the same block, with a reproduce command that
   returns 47 rows. The table runs to **G71**. The file's own instruction applies:
   derive it, do not carry it forward.
