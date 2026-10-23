# Model gaps found while drawing the routes — MG1–MG30

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NONE. This file decides nothing and owns nothing. It is
> evidence produced on one day by one pass, and every authority it names outranks
> it.
> A snapshot under **G32** — *"an unowned document that looks like a control is
> worse than none; one that says it is a snapshot is just evidence."* It is not
> maintained, and it must not be edited into currency. If a gap below closes, the
> closing commit is the record; **this file will go stale and is supposed to.**
> *Written 16 August 2026. Found against `743e843d`; re-verified against
> `03496821` plus an uncommitted working tree, and **one gap closed in between** —
> see MG10.*

> ⚠️ **DATED SNAPSHOT, 16 August 2026. NOT A LIVING CONTROL, and not maintained.**
>
> Thirty gaps were reported by the pass that drew the eleven route screens under
> `design/routes/`. **Every one was re-verified here, by hand, before it was
> written down** — the reproducing command is printed beside each row with the
> output it gave. A gap that had not reproduced would be in §7 under *claimed and
> not reproduced* rather than quietly dropped; §7 records what §7 actually holds.
>
> **The authorities this file reads, each of which outranks it:**
> `model/*.ts` for what is declared, with `@dropped-for-v1` **on the declaration**
> deciding what is built · `docs/contracts/*.openapi.yaml` for what has an
> operation · `docs/HANDOFF.md` §3 for the decisions · `design/routes/*.html` and
> `Mockups/rec/*.dc.html` for what is drawn · `docs/screen-pack-ledger.md` for the
> screen-to-model join this file is the negative image of.
> Where this file and any of those disagree, **they are right and this is stale.**
>
> 🛑 **THE TREE MOVED THREE TIMES WHILE THIS FILE WAS BEING WRITTEN, AND EVERY TIME
> IT INVALIDATED CITATIONS THAT STILL RESOLVED.** A concurrent pass was landing
> **O-16** in `model/`, `tests/` and `docs/contracts/` in the same working tree.
> `HEAD` went `743e843d` → `03496821` mid-verification and the working tree kept
> moving after that:
>
> - **Four citations into `model/domain.ts` drifted** — `:3003`, `:3015`, `:3735`
>   and `:4322` as first drafted. Every one still **resolved**: to an unrelated
>   brace, a comment line, a sentence about approvers, and a docblock. They are now
>   `:3048`, `:3060`, `:3780` and `:4367`.
> - **Every citation into `model/reconciliation.ts` drifted twice** — first by
>   exactly one line, then by between nineteen and three hundred, because the second
>   edit was not uniform across the module. Thirteen citations, silently wrong both
>   times, resolving both times. `checkPostconditions()` alone went `3826` → `3827`
>   → `4105`.
>
> **All seventeen were re-derived by grep immediately before this was committed**,
> which is the only reason they are right. That is the defect class `CLAUDE.md`
> narrates six times on its own page, reproduced here three times in under two
> hours, in a file written specifically to avoid it.
>
> 🛑 **THAT SENTENCE WAS TOO BROAD, AND THE FILE CONTRADICTED IT IN ITS OWN §3.2 —
> CORRECTED 16 Aug 2026, A FOURTH INSTANCE OF THE CLASS THIS BANNER IS ABOUT.**
> "All seventeen" covered §3.1, MG16 and MG22, which were re-derived against the
> **uncommitted working tree**. It did **not** cover §3.2's three, which were
> measured against **`HEAD` at `c56119f3`** and were correct there — so this file
> shipped `checkPostconditions()` at `:4105` in §3.1 and at `:3826` in §3.2, ten
> lines and one measurement base apart, with the banner above asserting that
> could not happen. **Mixing two bases is defensible; not naming them is not.**
> §3.2 and MG22 now carry the correction and print the grep instead of the
> number; §3.1's figure is dated to its base.
>
> ⚠️ **AND ONE MORE THING THE CHECKER STRUCTURALLY CANNOT SEE.** §3.2's citations
> were written as bare `:NNNN` **with no filename**, so
> `tools/check-citations.mjs` could not resolve them at all — its silence there
> was not the "it resolves" reason §6.2 gives, it was that there was nothing to
> resolve. **A citation with no file is invisible to the tool twice over.**
>
> 🛑 **THE CONSEQUENCE, AND IT IS THE MOST USEFUL SENTENCE ON THIS PAGE: RE-GREP, DO
> NOT COPY.** Every row that cites a declaration prints the `grep` that finds it.
> **The `grep` is the authority; the number beside it is a convenience with a shelf
> life measured in commits**, and in `model/reconciliation.ts` that shelf life was
> under thirty minutes. `tools/check-citations.mjs` cannot help — it reports
> **0 problems** for this file, and reported 0 for each of the three wrong versions
> too, because every one of them resolved.

---

## 0. Why MG and not G — the renumber, and the collision it avoids

The pass that found these numbered them **G1–G30 in its own local scheme.** That
numbering **collides head-on** with `docs/HANDOFF.md` §3, whose G-decisions are the
authority on every decision in this repository and which currently run to **G190**:

```bash
grep -oE '^\| G[0-9]+ ' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1   # 190
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                                         # 190
```

> ⚠️ **BOTH FIGURES READ 183 UNTIL 16 Aug 2026 AND ARE SWEPT HERE RATHER THAN
> DELETED, BECAUSE THE REASON THEY MOVED IS THIS SECTION'S OWN SUBJECT.** They
> moved by **merge, not by a ruling**: `origin/main` carried seven rulings
> (G179–G185) this branch had never seen, **and five rulings drafted here as
> G179–G183 were renumbered to G186–G190 because the two sessions minted the same
> identifiers independently.** 🛑 **That is precisely the collision this section
> was written to avoid, arriving in the G namespace itself while this page was
> avoiding it in the MG one** — and unlike MG-versus-G, it was not caught by
> foresight but by a merge conflict. `docs/HANDOFF.md` §3's Pass J banner records
> the mapping. **Run the two commands; do not read the numbers.**

So the collision is **total**, not partial: every one of the reporting pass's
thirty local numbers is already the number of a ruling. Its local *"G11"* is the
arrivals denominator; `docs/HANDOFF.md`'s **G11** is something else entirely, and a
reader meeting *"G11"* in a commit message six weeks from now has no way to tell
which was meant. **A gap is not a decision**, and the two must not share a
namespace.

**They are renumbered MG1–MG30 here, in the reporting pass's original order.** The
mapping is the identity: the pass's local `Gn` is this file's `MGn`. **Do not
reuse the local numbering anywhere** — including in a commit message that cites
this file.

> ⚠️ This is not a hypothetical class of confusion. `docs/HANDOFF.md` §7 records a
> stale contract enum that sat on the access path for two days because three
> consecutive steps mistook a derivation for a decision. An identifier that
> resolves to the wrong thing is the defect shape this record punishes hardest,
> and six instances of its `file:line` cousin are narrated on `CLAUDE.md` alone.

---

## 1. What this is, and what it is not

**It is the negative image of `docs/screen-pack-ledger.md`.** That file joins a
drawn screen to the model types, capabilities and operations behind it. This one
records what was **not** there when eleven routes were drawn against the tree:

```
design/routes/entry.html     /  ·  /signin  ·  /signin/lapsed  ·  /invite
design/routes/close.html     /close  ·  /close/run/:runId  ·  /close/run/:runId/refused
design/routes/finding.html   /close/finding/:ref  ·  …/confirm  ·  …/post
design/routes/ask.html       /ask
design/routes/reports.html   /reports
```

**It creates no scope and closes no question.** Every row is derived. Where a
`docs/HANDOFF.md` §3 ruling already governs a gap, the row **says which ruling and
stops** — it does not restate the decision, and it is not permission to
relitigate one. Eleven of the thirty are already ruled: G74, G106, G118, G139,
G153, G162, G167, G173, G174, G175, G178. All eleven exist as rows —
`for n in 74 106 118 139 153 162 167 173 174 175 178; do grep -cE "^\| G$n \|" docs/HANDOFF.md; done`
returns `1` eleven times.

**A gap here is not an argument that the thing should be built.** Several of these
are correctly absent for v1 and one — MG11 — cannot be built against the current
model at all. The file records the absence and the route it blocks; **what to do
about it is somebody's call, not a transcription.**

**What a verified gap proves, and what it does not.** It proves the noun is not in
the tree today. It does not prove the screen is right to want it, that the screen
is drawable once it exists, or that the fix is one commit. `docs/HANDOFF.md` §5.10
is the standing warning in the other direction: a green `tsc` over a types-only
model proves almost nothing, so an *absence* verified by grep is actually the
stronger of the two kinds of evidence available here.

---

## 2. How to read a row

- **Missing** — the noun, evaluator, operation or producer that is not there.
- **Why a drawn screen needs it** — the specific thing on a specific route that
  cannot be drawn honestly without it.
- **Reproduce** — the command, with the output it gave at `03496821`.
  ⚠️ **`grep -c` counts MATCHING LINES, not matches.** That exact confusion shipped
  a wrong count in this repository, so every count below states which it is.
- **Blocks** — the route(s).
- **Ruled** — the `docs/HANDOFF.md` §3 row that already governs it, or `—`.

---

## 3. The two that are different in kind

These two are pulled out of the list because reading them as ordinary rows
understates both.

### 3.1 · MG11 — THE ARRIVALS DENOMINATOR. Every completeness claim on every screen bottoms out here

The engine knows what it was **PRESENTED**. Nothing in the tree knows what
**ARRIVED**.

`presentedRowsOnSide()` (`model/reconciliation.ts:1527`) folds a count out of the
documents the engine was **handed**, and its own docblock at `:4413` says so in
capitals — *"IT FOLDS `presentedRowsOnSide` RATHER THAN READING `documents.length`"*.
That is the correct behaviour for what it is: a fold over the population it
received. **It is not a denominator for coverage**, because nothing upstream of it
records what the counterparty sent.

```bash
grep -n 'presentedRowsOnSide' model/reconciliation.ts
#  1527 · 1926 · 4413 · 4426 · 4451 · 4457  — six matching lines, all presentation-side
grep -rniE 'arrivedRows|expectedRows|arrivalManifest|declaredRowCount' model/*.ts | wc -l   # 0
```

**Why this is different in kind from the other twenty-nine.** Every other gap is
*unbuilt*: someone writes a type, an evaluator, an operation, and it closes. This
one is **uncomputable from anything the tree holds.** No amount of code written
against the current model produces the number, because the fact — *what was sent* —
enters the system nowhere. Closing it requires a **source-side control total** at
the point of arrival, which is an ingestion decision and a counterparty
conversation before it is a type.

**What it costs on the drawn screens:** every "N of M" on `/close`, every coverage
meter, every completeness sentence on `/reports`.

🛑 **And it got sharper on 12 Aug 2026, not softer.** G153's third run outcome —
`incomplete` — **landed in `RunStatus` and on the wire while this file was being
written** (MG10). So `incomplete` is now a **declarable outcome with no producer**:
`checkPostconditions()` (`model/reconciliation.ts`, `grep -n 'export function
checkPostconditions' model/reconciliation.ts` → **4115** on 16 Aug 2026; ⚠️ **this
read `:4105` until then, and `:4105` still resolves — to the doc-comment line
`* 🛑 THE THIRD PARAMETER IS THE OPERAND C13 NEEDED…`, not to the declaration.
That is the resolving-but-wrong class this file exists to avoid**)
is an internal-consistency
check over the **admitted** set, so the engine can say *"what I was given
balances"* and can never say *"I was given everything."* The status a screen would
render exists; the fact that would set it does not. **A representable state that
nothing can compute is a worse position than an absent one**, because a reader of
the union will reasonably assume something sets it.

**Ruled:** G153 rules the outcome and is ✅ applied for the member. **The
denominator is ruled by nothing.**

### 3.2 · MG9 — THE ENGINE IS ON NO CONTRACT TIER. Thirteen commits of engine work and no operation exposes any of it

```bash
grep -rniE 'admission_refusal|residue|control_total|postcondition' docs/contracts/
#   (no output — zero matching lines, across all five files and all four tiers)
git log --oneline -- model/reconciliation.ts | wc -l                    # 13
```

**Zero.** Not one operation, schema, enum member or description across
`capability.openapi.yaml` (33 paths), `foundation.openapi.yaml` (17),
`control-plane.openapi.yaml` (14) and `data-plane-local.openapi.yaml` (3) names an
admission refusal, a residue entry, a control total or a postcondition.

> ⚠️ **THAT COMMAND NO LONGER RETURNS ZERO. Re-run 16 Aug 2026: it returns THREE
> matching lines.** The block above is left exactly as it was written — it was
> honest at this file's own commit, and `git show c56119f3:docs/contracts/…`
> confirms the zero — but a reader running it today gets output, so the
> parenthetical *"(no output — zero matching lines…)"* is now false as printed.
> The four path counts were re-derived the same day and all four still hold.
>
> **Two of the three hits confirm the finding rather than contradict it** —
> `docs/contracts/capability.openapi.yaml:2618` and `:2623` are *comments*, landed
> by the concurrent engine work, and they say of themselves that
> `SetReconciliationResult.completeness` *"reaches NO contract tier. Neither does
> `postconditions`, `residue`, `admissionRates` or `refusedAtAdmission`"*. That is
> this row's own claim, written into the contract by someone who met it
> independently.
>
> 🛑 **THE THIRD IS A REAL ENUM MEMBER AND IT NARROWS THE HEADLINE. Recorded
> rather than absorbed, because it is the one hit that is not a comment.**
> `docs/contracts/control-plane.openapi.yaml:1722` carries
> `admission_refused, postcondition_failed` inside the `findings[].kind` enum.
> So the sentence above — *"Not one operation, schema, ENUM MEMBER or
> description … names an admission refusal … or a postcondition"* — **is false
> for the control-plane tier as of 16 Aug 2026.**
>
> **The finding itself survives, and the qualification is precise.** That enum is
> an operational telemetry rollup: `kind` plus `count`, `p50Ms`, `p95Ms`,
> `maxMs`. It carries no reason, no side and no document id, and it says so —
> *"An error KIND is our own operational fact; an error MESSAGE is whatever text
> a tenant's data provoked, and no member here carries one."* It is also on the
> plane that under invariant 3 never reads tenant data. So the platform can now
> count that admissions were refused; **no tenant-facing tier can still say WHICH
> ones or WHY**, which is the whole of what this row claims. Restated for the
> tiers that matter: **`capability`, `foundation` and `data-plane-local` name an
> admission refusal, a residue entry, a control total or a postcondition in
> ZERO operations, schemas and enum members.** Re-derive both halves:
>
> ```bash
> grep -rniE 'admission_refusal|residue|control_total|postcondition' docs/contracts/
> grep -rniE 'admission_refusal|residue|control_total|postcondition' \
>   docs/contracts/capability.openapi.yaml \
>   docs/contracts/foundation.openapi.yaml \
>   docs/contracts/data-plane-local.openapi.yaml | grep -v '^\S*: *#'
> ```
>
> ⚠️ **And the commit count in the block and in this heading has moved: it is 14,
> not 13** (`git log --oneline -- model/reconciliation.ts | wc -l`, 16 Aug 2026).
> The heading's word *"Thirteen"* is left standing as the dated snapshot it is —
> §7 already records that the finding does not depend on it.

**Why this is different in kind.** Every other missing-operation row in this file
sits over something that **does not exist** — an absent operation over an absent
type is not a finding, it is arithmetic. This one sits over a **built** engine.
`model/reconciliation.ts` carries `AdmissionRefusal` (⚠️ **this said *with
seven arms* and the tree says eight since OQ-1 was fixed; derive it rather than
either number — the `awk` in MG16 below**), `RefusedItem`, `ResidueEntry`,
`checkPostconditions()`, `applyReaderVerdicts()` and a scenario corpus behind
all of it. The
defect is not that the work is missing; it is that **the work cannot be reached
from outside the process.**

> 🛑 **THIS PARAGRAPH CITED THREE DECLARATIONS AT LINE NUMBERS THIS FILE
> CONTRADICTS ELSEWHERE, AND THE BANNER AT THE TOP OF THIS FILE ASSERTS THE
> OPPOSITE. CORRECTED 16 Aug 2026 — the numbers are removed rather than
> refreshed.** It read: *"`AdmissionRefusal` with seven arms (`:1046`), …
> `checkPostconditions()` (`:3826`), `applyReaderVerdicts()` (`:3345`)"*.
>
> **THE FILE MIXED TWO MEASUREMENT BASES AND SAID SO NOWHERE.** §3.1, MG16 and
> MG22 were measured against the **uncommitted working tree**; §3.2's three were
> measured against **`HEAD` at this file's own commit `c56119f3`**, where they
> were exactly right — `git show c56119f3:model/reconciliation.ts` puts them at
> 1046, 3345 and 3826. Both halves were defensible; presenting them side by side
> without naming the base was not. The banner at the top of this file reads *"All
> seventeen were re-derived by grep immediately before this was committed, which
> is the only reason they are right"* — that sentence covered §3.1/MG16/MG22 and
> **did not cover these three**.
>
> Against the tree on 16 Aug 2026 all three resolved to nothing of the kind:
> `:1046` → `readonly gross: Money`, `:3345` → a lone `}`, `:3826` → a bare ` *`.
> **Worse for a reader, and worse for the checker:** they were written as bare
> `:NNNN` with no filename, so `tools/check-citations.mjs` cannot resolve them at
> all. Its silence here is **structural**, not the resolving-but-wrong reason
> §6.2 gives.
>
> **The fix is this file's own rule applied to itself — RE-GREP, DO NOT COPY.**
> The numbers are gone from the prose; the grep is the authority:
>
> ```bash
> grep -n 'export type AdmissionRefusal\|export function checkPostconditions\|export function applyReaderVerdicts' model/reconciliation.ts
> #   AdmissionRefusal      → line 1066   (16 Aug 2026, working tree)
> #   applyReaderVerdicts   → line 3365
> #   checkPostconditions   → line 4115
> ```
>
> (⚠️ **The three results are written `name → line N` rather than pasted as raw
> `grep -n` output on purpose.** A pasted line reads `1066  export type …`, and
> `tools/check-doc-counts.mjs` matches a number in the 300–2000 band next to the
> noun `exports?` — so the paste made this file report **STALE, claiming 1066
> exports against a tree of 854**, and failed `npm run check`. The count control
> cannot tell a line NUMBER from a COUNT; keep the digits away from the noun.)
>
> ⚠️ **Those three numbers are a convenience with a shelf life measured in
> commits, and §3.1 below still prints `:4105` for `checkPostconditions()` from a
> base ten lines shallower.** The engine module is under active concurrent edit;
> run the grep.

The wire does carry runs — `/runs`, `/runs/{runId}`, `/runs/{runId}/rerun` — and
the `Run` schema mirrors `RunStatus` verbatim
(`docs/contracts/capability.openapi.yaml:2600`, and the query parameter at `:312`)
**and carries no failure-reason field** (`:2591-2612`, the full property list). So
a refused run reaches the operator as the bare word `failed` while the engine's own
refusal carries a reason, a side and a document id. **That is the shape of the
whole finding:** the run is on the wire; nothing the run *concluded* is.

⚠️ **And the one piece of engine vocabulary that did reach the wire proves the
rule.** O-16 mirrored `RunStatus`'s new `incomplete` member into both wire copies
on 12 Aug 2026 — a **status**, four characters of outcome. The refusals, the
residue, the control totals and the postconditions behind that status remain at
zero.

Fourteen of `close.html`'s twenty-six hatched regions say this one thing.

**Ruled:** nothing. This is not in §3 at all, and it is the largest single finding
in this file.

---

## 4. The shape — twenty-one is wrong; it is twenty-six

The reporting pass recorded a shape observation under its list:

> *"twenty-one of the thirty are the same failure at different grains — a control
> the drawn product offers has no type, no evaluator, no operation or no
> denominator."*

**The shape is right. The count is wrong, and it is wrong low.** It is **26**.

**The rule used to count, stated so it can be re-adjudicated:** a row is the shape
when the thing the drawn screen needs is **ABSENT** from `model/` and
`docs/contracts/` — no declaration, no evaluator, no operation, no producer for a
quantity. A row is **not** the shape when the thing **is present** and the defect
is its depth, its reach, or what it permits.

| Not the shape | Why |
|---|---|
| **MG11** | An absence no code against the current model can remedy — §3.1. |
| **MG15** | Both quantities exist. The defect is that nothing stops a screen conflating them. |
| **MG23** | `ApprovalConfig.segregationOfDuties` exists (`model/policy.ts:231`). The defect is that it has no non-vacuous form against an agent proposer. |
| **MG26** | `_CarriedTurnHoldsNoText` exists — derive it, `grep -n '_CarriedTurnHoldsNoText' model/identity.ts`. The defect was that it was one level deep and read as though it were not; ✅ **resolved 22 Aug 2026, #240**. It stays out of the shape either way: the row was never about an absence. ⚠️ **This cited `model/identity.ts:1125` until 22 Aug 2026 and the migration moved the declaration, so the number now resolves to a docblock line — the grep anchor above replaces it.** |

30 − 4 = **26**.

**Where 21 probably came from, offered as reconstruction and not as a claim about
intent.** The shape note sat directly under the list, and **MG9–MG30 is 22 rows;
less MG11 it is exactly 21.** The eight entry-route gaps — MG1–MG8, every one of
them a control the drawn product offers with no type and no operation — appear to
have fallen outside the range the observation was made over. They are the same
failure. Counting them is the correction.

**MG17 is the boundary call and it is counted IN.** `FieldSpec.path` is present but
is `FieldPath = string`; what is absent is any binding from a `FieldSpec` to a
position in a JSONB document, which is a whole missing mechanism rather than a
weak one. A reader who counts it out gets **25**; the rule above is printed so
that disagreement is legible rather than invisible.

---

## 5. The thirty

### Entry — `/` · `/signin` · `/signin/lapsed` · `/invite`

**MG1 · There is no session type at all.**
All four entry routes establish, hold or end one; nothing in eighteen modules
declares one.
`grep -rn 'export interface Session' model/*.ts | wc -l` → **0**.
`ls model/*.ts | xargs -n1 basename` returns no `session.ts`.
The model graph already carries this as a `module_specified_not_written / session`
gap — a document promising a file.
**Blocks:** all four entry routes. **Ruled:** — (the graph gap is evidence, not a
ruling).

**MG2 · `selectTenantForSession()` does not exist.**
G167 specifies the signature, the reasoned union it returns and the check against
three constants. Both arms of the tenant picker on `/signin` are drawn hatched
because of it.
`grep -rl 'selectTenantForSession' model/ | wc -l` → **0**.
**Blocks:** `/signin` (both picker arms). **Ruled: G167.**

**MG3 · No second factor anywhere.**
No MFA, TOTP, authenticator or recovery-code type.
`grep -rniE 'secondfactor|second_factor|\bmfa\b|totp|authenticator|recovery.code' model/*.ts | wc -l`
→ **0** matching lines.
**Blocks:** `/signin`. **Ruled:** —

**MG4 · No lockout policy, attempt counter or lock state.**
The replaced screen counted down to a fifteen-minute lock; nothing holds an
attempt, a threshold or a duration, so both slots render an em-dash.
`grep -rniE 'lockout|lockedUntil|attemptCount|failedAttempts|maxAttempts' model/*.ts | wc -l`
→ **0** matching lines.
**Blocks:** `/signin`. **Ruled:** —

**MG5 · No idle timeout and no session lifetime.**
`grep -rniE 'idleTimeout|sessionLifetime|sessionTimeout|idle_timeout' model/*.ts | wc -l`
→ **0** matching lines.
🛑 **And the tempting substitute is the trap.** `MAX_AUTHORIZATION_SECONDS`
(`model/access.ts:1517`) is a **grant** ceiling keyed by resource class. Reading it
as a session clock is precisely the landmark substitution `docs/HANDOFF.md` §5.1
catalogues — a rule keyed on a convenient landmark instead of the property it
protects — and a lapsed-session screen is the surface most likely to make it.
**Blocks:** `/signin/lapsed`. **Ruled:** —

**MG6 · ~~There is no `model/held-work.ts`.~~ ✅ CLOSED 23 Aug 2026 — #238 [A-15].**
G162 rules it a new module rather than more of `model/domain.ts`; G156 gives an
open draft **two** independent clocks — an absolute cap from creation and an idle
expiry, with touching the draft unable to extend the cap. Neither module nor clock
existed, so neither clock had a number to render.
~~`ls model/held-work.ts` → `No such file or directory`.~~ **The reproducing
command is inverted: it now resolves.**
**Blocks:** `/signin/lapsed` (the "work held" panel). **Ruled: G162, G156.**

**What closed it, and what did NOT.** `model/held-work.ts` exists under G225,
`MODULE_COUNT` moved 22 → 23, and the extractor's
`module_specified_not_written / held-work` gap is gone. `purgeAfterForHeldDraft()`
is G156's formula — `least(heldAt + maxOpenDraftAge, lastHeldAt + days.held_work)`
— with `heldAt` `readonly`, so **no touch can raise the value `Math.min` chooses
between**, and `latestPossiblePurge()` states G233's required abandonment rule as
a bound `lastHeldAt` does not enter into.

🛑 **BOTH CLOCKS STILL HAVE NO NUMBER, AND THAT IS THE POINT RATHER THAN A
SHORTFALL.** G139 rules both bounds FDE-set configuration refusing on absence, and
`PRODUCT.md` forbids inventing a figure; `validateHeldWorkBounds()` refuses, which
means no draft can be held until a deployment states them. **`/signin/lapsed` can
now RENDER a clock; it still cannot be given one.** The idle bound's source is
`RetentionPolicy.days.held_work` — the fourteenth retention class, G233 — which
`docs/HANDOFF.md` §8 item 2 records as counsel's, along with the other thirteen.
Derive the module: `grep -c 'export function purgeAfterForHeldDraft' model/held-work.ts` → 1.

**MG7 · No invitation type.**
No invite row, no expiry, no accept-or-decline transition. `/invite` draws a flow
whose state has nowhere to live.
`grep -rniE 'export (interface|type|const) [A-Za-z]*Invit' model/*.ts | wc -l` → **0**.
**Blocks:** `/invite`. **Ruled:** —

**MG8 · Nothing about the way in is on the wire.**
Sixty-nine paths across four tiers and not one signs in, exchanges a token, takes
a second factor, selects a tenant or signs out. ⚠️ *Read "sixty-seven" until
16 Aug 2026; the two new paths are the engine's read surface and neither is a
way in, so the finding is unchanged in substance.*

```bash
grep -hcE '^  /' docs/contracts/*.openapi.yaml | awk '{s+=$1} END{print s}'   # 69
grep -nE '^  /' docs/contracts/*.openapi.yaml                                # the full list
```

⚠️ **Two paths look like the answer and are not.** `/access/sessions`
(`docs/contracts/control-plane.openapi.yaml:784`, `operationId: reportAccessSessions`)
is a **report of what a staff support session touched** — *"THE GRANT PERMITS; THE
SESSION RECORDS"* — not an authentication surface. `/identity/membership`
(`docs/contracts/foundation.openapi.yaml:85`, `resolveMembership`) resolves the
role a user holds **in an already-resolved tenant**; it presupposes the selection
MG2 says has no function.
**Blocks:** all four entry routes. **Ruled:** — (D1 is gated behind G165's threat
model).

### Close — `/close` · `/close/run/:runId` · `/close/run/:runId/refused`

**MG9 · The engine is on no contract tier.** See §3.2. **Blocks:** all three close
routes, both finding routes that read a run, `/reports`. **Ruled:** —

**MG10 · `RunStatus` carries no failure reason.**

> ✅ **HALF OF THIS GAP CLOSED WHILE THIS FILE WAS BEING WRITTEN, AND THE CLOSED
> HALF IS RECORDED RATHER THAN DELETED.** As reported and as first drafted here,
> this row read: *"`RunStatus` has four members … G153's third outcome —
> `incomplete` — is not a member either."* **Both clauses were true at `743e843d`
> and the second went false at `f580378b`**, which landed O-16's third outcome.
> The member list is now five, and it is mirrored on the wire in both copies —
> including the `/runs` query parameter that `tools/check-wire-mirror.mjs` says in
> its own output it cannot reach. Derive it:
>
> ```bash
> grep -n 'export type RunStatus' model/domain.ts
> # 2822: export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'incomplete'
> grep -n 'enum: \[queued' docs/contracts/capability.openapi.yaml
> #  312 · 2600  — the query parameter and the `Run` schema
> ```

**What is still missing is the failure reason**, and it did not move.
`model/domain.ts:2822` is a bare status union; the `Run` schema's complete
property list (`docs/contracts/capability.openapi.yaml:2591-2612`) is `runId`,
`definitionId`, `definitionVersion`, `periodId`, `trigger`, `status`, `inputs`,
`startedAt`, `finishedAt`, `exceptionsRaised` — **no reason, no side, no document
id.** So a refused run still reaches the operator as the bare word `failed` while
the engine's own refusal carries all three (`AdmissionRefusal`,
`model/reconciliation.ts:1066`, and `RefusedItem` under it, which holds a `side`,
a `ref` and a `path`).
⚠️ **And `incomplete` now has the opposite problem:** the outcome is declarable and
nothing can compute it — see MG11, which is why.
**Blocks:** `/close`, `/close/run/:runId/refused`, `/reports`. **Ruled: G153**
(✅ applied for the member; the failure reason is ruled by nothing).

**MG11 · No arrivals denominator.** See §3.1. **Blocks:** every completeness claim
on every route. **Ruled:** partially, G153.

**MG12 · No document-level or type-level mean confidence.**
`Provenance` (`model/domain.ts:1828`) is three fields — `page`, `boundingBox`,
`confidence` — and its `confidence` is **per extracted value**. The drawn pack
asserts *"read at 94% mean confidence"* and warns that *"a type-level average of
92% would look healthy while one warehouse quietly fails"*
(`docs/screen-pack-ledger.md:666`, `:669-670`). No type carries either figure.
`grep -rniE 'meanConfidence|averageConfidence|avgConfidence|confidenceMean' model/*.ts | wc -l`
→ **0**.
**Blocks:** `/close` (the confidence rows), `/close/finding/:ref/confirm`.
**Ruled:** —

**MG13 · There is no FDE surface, so no floor or ceiling has a source.**
G139 rules that every `IngestBound` number, every C6 threshold and every C13 floor
is **FDE-set pack configuration that refuses on absence** — the conformance
ceiling, the reader candidate cap, the similarity bound, the subset-sum bound and
`FieldSpec.confidenceFloor` (`model/domain.ts:1764`) among them. There is no
surface on which any of them is set.
`ls docs/contracts/administration.openapi.yaml` → `No such file or directory`.
**Blocks:** every route that renders a floor or a ceiling — `/close`, both
`/close/finding/:ref` reads, `/ask`. This is what the four undrawn `/platform/*`
routes would close. **Ruled: G139** (and `docs/contracts/README.md` already names
the administration file as one that *"does not exist and should"*).

**MG14 · No residue-to-exception join.** ✅ **CLOSED 24 Aug 2026 — #247 [W-12],
G228.**
`Exception` (derive it —
`grep -n 'export interface Exception extends TenantScoped' model/domain.ts`; ⚠️
this cited `:3060`, `:3062` and `:3063`, and the declaration has moved since)
requires `matchGroupId` and `ruleId` at **document** grain. A
residue entry is addressed by `ItemRef` (`grep -n 'export interface ItemRef'
model/reconciliation.ts`) at **line**
grain. Nothing converted one to the other, so a finding opened from a residue row
could not carry its own audit trail.
**Blocks:** `/close` → `/close/finding/:ref` (the open-a-finding transition).
**Ruled: G228** — *a line-grain finding is a SECOND ROW TYPE beside `Exception`,
not a widening of it*, because widening changes the meaning of every existing
`Exception` reader while the second type announces itself.

🛑 **HOW IT IS CLOSED, AND THE HONEST SHAPE OF WHAT WAS BUILT.**
`model/reconciliation.ts` §6a declares `LineFinding` —
`{ grain: 'line', runId, side, ref, cause, disposition }` — and
`openLineFinding(result, runId, side, ref)`, which either yields one or returns a
closed `LineFindingRefusal`. `Exception` is **untouched**: both fields stay
required. **No `matchGroupId` is synthesised**, and
`tests/model/residue-to-exception.test.ts` makes that mechanical by grepping the
module's code for the identifier and requiring zero.

⚠️ **WHAT THE ROW DELIBERATELY DOES NOT CARRY, because a closed gap that hides a
new one is worse than an open gap.** No `Money` and no `FieldPath` — each is a
bare `string` at a property position and would fail the containment proof the
same commit adds. The amount stays on `ResidueEntry.settlement` and the paths on
`.heldReads`, both read through `listRunResidue` under the same capability. And
it does not extend `TenantScoped` and carries no id: the engine has no clock and
no identity, so the persisted row — its id, its tenant, its timestamps — is
#145's and the writer's, inside `withTenantScope()`.

⚠️ **`FindingBasis`'s ARITY IS STILL OPEN AND IS NOT THIS GAP'S TO CLOSE.** G228
says so on itself; it is [W-14]'s. Nothing in the conversion reaches
`standingFor()`, and two independent answers to one question is §5.3's
two-vocabularies defect arriving by another door.

⚠️ **NO OPERATION PRODUCES A `LineFinding` YET.** `/close/finding/:ref` is
#213's. The `LineFinding` and `LineFindingRefusal` schemas are on the capability
tier and the refusal vocabulary is pinned by the `line_finding_refusal_kinds`
wire-mirror pair — declared in the commit that mints the enum rather than after
the drift a pair exists to catch. **So the JOIN exists and the ROUTE does not**,
and that is the exact remaining distance.

**MG15 · The refusal RATE is per SIDE; the RESIDUE is over BOTH.**
`presentedRowsOnSide(input.documents)` is consumed one side at a time
(`model/reconciliation.ts:1926`), while `runSetReconciliation` builds the residue
from `[...left.refused, ...right.refused]` (`:4316`). **Nothing in the type system
stops a screen drawing the two as one quantity** — `finding.html` did exactly
that, and it was the blocker its red team caught.
⚠️ **This is not an absence.** Both quantities exist and both are correct; what is
missing is anything that prevents the category error. It is therefore counted
**out** of §4's shape.
**Blocks:** `/close/finding/:ref` (the rate strip). **Ruled:** —

### Finding — `/close/finding/:ref` · `…/confirm` · `…/post`

**MG16 · `AdmissionRefusal` carries no below-confidence-floor arm.**
Seven arms when this gap was written, derived:
`awk '/^export type AdmissionRefusal =/,/^export type _AdmissionRefusalHoldsNoText/' model/reconciliation.ts | grep -cE "^  \| \{ kind:"`
(`field_not_classified`, `field_absent`, `amount_not_money`,
`date_not_extractable`, `date_not_iso_calendar`, `identifier_not_extractable`,
`money_unit_disagrees_with_declared`), declared in §4 of
`model/reconciliation.ts` — ⚠️ **that citation said `:1066` and is replaced by
a grep anchor rather than re-numbered**; derive it,
`grep -n 'export type AdmissionRefusal' model/reconciliation.ts`.
⚠️ **THE `awk` RETURNS 8 AT THE TREE AND THIS LINE SAID → 7 UNTIL OQ-1 WAS
FIXED.** The eighth is `amount_not_exact_money`, which has nothing to do with
this gap — see the closure note below.
**None is a floor breach, and that is correct rather than missing:**
`FieldSpec.confidenceFloor`'s own doc comment says a read
below the floor means *"a person is asked instead of guessed at"* — **held and
asked, not refused.**
(⚠️ **This said *"own declaration (`model/domain.ts:1733`)"* until 16 Aug 2026.
`:1733` is the DOC COMMENT the sentence is quoted from, not the declaration —
the field itself is at `:1764`. Both moved with the concurrent engine work;
re-derive rather than copy: `grep -n 'confidenceFloor' model/domain.ts`.) The gap is that no type expresses the held state either.

✅ **CLOSED 23 Aug 2026 — G227, #248 [W-13]. THE SEVEN ARMS WERE UNCHANGED AND
THAT WAS PART OF THE CLOSURE RATHER THAN A CAVEAT ON IT.** ⚠️ **THIS READ *"THE
SEVEN ARMS ARE UNCHANGED"* AND *"the `awk` above still returns 7"*, AND BOTH WENT
FALSE WHEN OQ-1 WAS FIXED. They are corrected rather than deleted, because a
reader counting eight arms would otherwise conclude G227 had been overruled. It
has not been.** The arm G227 refused was a FLOOR BREACH, because a refusal
DISCARDS the value and the floor's own sentence requires a person to see it — and
no arm of that union is one. The arm that later landed,
`amount_not_exact_money`, refuses an amount that cannot be added, subtracted or
compared AT ALL, which is a different question with a different answer: there is
no value to show. The `awk` returns **8**; the control that guards this gap is
G227's hold suite under `tests/model/`, which was re-keyed off the COUNT and onto
the PROPERTY in the same commit — §5.1, arriving inside a control written to hold
§5.1's line. What landed is a
**twelfth `ResidueCause`** — `read_held_below_floor` — plus `HeldRead` and
`ResidueEntry.heldReads`, carrying the `ItemRef`, the declared `FieldPath`, the
confidence read and the floor missed. It **folds into the residue** rather than
onto a third channel because the residue already carries a caller obligation —
something must dispose of every entry, which is what makes `settlement` required
— so a held read dropped there inherits an obligation to resolve it. That is
C18's *"a channel with no caller obligation"* argument **applied**, not overruled.
⚠️ **The hold is enforced at `openItems()` and nowhere else**: a held item is
admitted, conserved and counted, and is never offered to a pass or to the
quarantined reader. Derive:
`awk '/^export type ResidueCause =/,/^export type _ResidueCauseHoldsNoText/' model/reconciliation.ts | grep -cE "^  \| \{ kind:"` → **12**.
⚠️ **No floor VALUE landed with it.** Under G139 the floor is FDE-set pack
configuration and there is still no surface that sets one ([M2-3]); the engine
takes a caller-supplied map and holds only what it was given a floor for.
**Blocks:** `/close/finding/:ref/confirm`. **Ruled: G227.**

**MG17 · G106's ADDRESSING half is not applied.**
The **refusal** half is executable: `grep -c 'field_not_classified' model/reconciliation.ts`
→ **5 matching lines** — one declaration plus four refusal sites — so an unmapped
path fails closed exactly as G106 requires. The **addressing** half is not.
`grep -n 'export interface FieldSpec' model/domain.ts` → `1717`; its first field is
`path: FieldPath` (`:1718`); and `grep -n 'export type FieldPath' model/kernel.ts`
→ `423: export type FieldPath = string`. An unstructured string with nothing tying
it to a payload key, so *"show me the key in the payload"* cannot be drawn.
**Blocks:** `/close/finding/:ref/confirm`. **Ruled: G106.**

**MG18 · There is no standing type.**
G74 rules that a finding's standing must be **DERIVED** from its basis and never
stored. Neither the derivation nor its vocabulary exists.
`grep -rn 'FINDING_STANDINGS\|standingFor' model/*.ts | wc -l` → **0**;
`grep -rnE '^export (type|const|interface|function) [A-Za-z_]*[Ss]tanding' model/*.ts | wc -l`
→ **0**; `FindingBasis` returns nothing at all.
⚠️ A loose `grep -rni 'standing' model/*.ts` returns **61 matching lines** and every
one is prose — *"a standing 90-day reach"* and its kin. **Use the precise commands.**
The State column's words are drawn; the machinery to filter or sort on them is not.
**Blocks:** `/close` (the register's State column), `/close/finding/:ref`.
**Ruled: G74.**

**MG19 · ~~`RulePredicate.unique_within` has no evaluator.~~ ✅ CLOSED 23 Aug 2026 — #239 [I-5].**
The predicate is declared — `grep -n "kind: 'unique_within'" model/domain.ts` —
and `model/reconciliation.ts` recorded in prose that it *"already exists in the
model"*. **Nothing evaluated it.** The only mechanism that noticed a duplicate
identifier was the identifier join declining an ambiguous pair — a different
thing, reported differently, at a different grain.
**Blocks:** `/close/finding/:ref` (a duplicate-identifier finding). **Ruled: G178.**

**The reproducing command, INVERTED.** It returned **2** — one declaration and one
prose note, which was the whole finding:

```bash
grep -rc 'unique_within' model/*.ts | grep -v ':0'   # now names §11 as well
```

`model/reconciliation.ts` §11 holds the evaluator, total over the four scopes,
plus G178's pure pre-flight extraction and the injected `knownUniquenessConflicts`
map. `db/migrations/0004_subject_ledger.sql` holds the table, whose `UNIQUE`
constraint is the race guard. All four amendments are built: **(a)** an unsupplied
map REFUSES rather than passing — the fail-open `conflicts.get(scope)?.has(digest)`
that `noUncheckedIndexedAccess` cannot catch; **(b)** the ledger stores a canonical
hash and never the raw subject value, and `SubjectDigest` is branded so a bare
`subjectValue: string` on the verdict is a `TS2344`; **(c)** the conflict map has a
canonical, order-stable pinning; **(d)** the retry is bounded and the suppression
counted.

🛑 **WHAT IS NOT CLOSED, STATED RATHER THAN IMPLIED.** `RunPlan` still does not
exist — `grep -rl 'RunPlan' model/*.ts` → **0** — and neither does any content key.
Amendment (c) is satisfied *in substance*, by minting the pinnable projection
rather than the plan, and the argument for that choice is in §11.3 and in #239's
own decision table: minting `RunPlan` inside a uniqueness slice would decide two
shared shapes from one caller's needs. **The next pinned input is the one that
should mint it.** And no operation is on the wire — a uniqueness verdict reaches an
operator through the residue/finding surfaces the W track is minting.

**MG20 · Nothing time-boxes a reversal.**
`ExceptionReversal` (`model/domain.ts:3048` —
`grep -n 'export interface ExceptionReversal' model/domain.ts`) records that a
reversal **happened**;
`Reversibility` classifies how hard a disposition is to undo; **no field bounds
when.**
`grep -rniE 'reversalWindow|undoWindow|withinMinutes|gracePeriod' model/*.ts | wc -l`
→ **0** matching lines. The only *"undo window"* in the tree is
`model/governance.ts:1369`, where `undo_window_expiring` is discussed as a drawn
**screen event name** and explicitly ruled **not** a `ServiceNoticeKind`.
🛑 The pack's *"four-minute reversal"* and every drawn countdown are therefore
**invented durations**, which `PRODUCT.md` forbids.
**Blocks:** `/close/finding/:ref/post`, `/reports`. **Ruled:** —

**MG21 · No capability names confirming or correcting an extracted field.**
The roster is closed at thirty-seven —
`awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'`
→ **37** — and the full key list contains nothing of the kind; the nearest are
`admit_correspondence` (a message, not a field) and `propose_resolution` (a
proposal, not a correction). No operation performs it either:
`grep -rniE 'operationId: .*(confirm|correct)' docs/contracts/*.yaml | wc -l` → **0**.
**`/close/finding/:ref/confirm` is a write drawn over a read-only authority**, and
under invariant 10 an act with no authorisation is unrecordable.
**Blocks:** `/close/finding/:ref/confirm`. **Ruled:** —

**MG22 · The reader seam has no executor, and the reader act has no capability.**
`applyReaderVerdicts` and `notImplementedReader` are both declared in
`model/reconciliation.ts`; the latter returns a refusal rather than a fabricated
empty result. This row printed the grep for the first and **only a bare number for
the second** — ⚠️ **and that number, `:3258`, was the one that drifted.** On
16 Aug 2026 `:3258` resolves to the doc-comment line
`*     a chained row until JCS lands.**`, not to a declaration. It was right at
`c56119f3` and moved with the concurrent engine work. **Corrected by printing the
grep this row already applies to its sibling, which is the file's own rule:**

```bash
grep -n 'export function applyReaderVerdicts\|export function notImplementedReader' model/reconciliation.ts
#   notImplementedReader  → line 3278   (16 Aug 2026, working tree)
#   applyReaderVerdicts   → line 3365
```

**Every caller of either is a test or a document** —
`grep -rn 'applyReaderVerdicts' model/ tests/ docs/ | grep -v 'model/reconciliation.ts:3365'`
returns matches only under `tests/` and `docs/`, plus one prose mention at
`model/reconciliation.ts:3048`. The corpus says so of itself:
*"nothing here calls a model, and no test built from this file may claim the seam
is integrated."*
Every agent-authored sentence in the route bundle rests on this, **including the
in-flight reading state**: if nothing can execute the read, the reading state
cannot occur.
**Blocks:** `/close/finding/:ref`, `/ask` (the reading turn). **Ruled: G118**
(executor), **G173** (the capability, which would be the thirty-eighth).

**MG23 · `ApprovalConfig.segregationOfDuties` has no non-vacuous form against an agent proposer.**
`model/policy.ts:231: segregationOfDuties: boolean`. The preparer/reviewer strip on
the drawn screen cannot claim a separation the field does not enforce, and both
candidate fixes are **decisions rather than edits.**
⚠️ **Counted out of §4's shape**: the field is present; what is missing is an
evaluator with a meaning against a non-human proposer.
**Blocks:** `/close/finding/:ref/post`. **Ruled:** —

**MG24 · There is no quantity floor of any kind.**
`AssignmentScope.valueCeiling` is `Money | null` (`model/access.ts:722`, the
interface at `:679`); `AutonomyConfig.autoResolveValueCeiling` is
`MoneyAmount | null` (`model/policy.ts:155`). **No function converts between them
and neither is a quantity.**
`grep -rniE 'quantityFloor|minQuantity|quantityCeiling|onHandQuantity' model/*.ts | wc -l`
→ **0**; `grep -rnE '\bquantity\b' model/domain.ts` → **2 matching lines**, both
prose. The inventory floor the blocked posting is measured against has no home, no
owner and no version.
**Blocks:** `/close/finding/:ref/post` (the inventory precondition). **Ruled:** —

### Ask — `/ask`

**MG25 · Ask has no refusal type, no request type of its own, and no wire.**
`AskSession` (`model/domain.ts:4367` —
`grep -n 'export interface AskSession' model/domain.ts`) is **six** fields — `id`, `askedByUserId`,
`startedAt`, `turns`, `attachedToExceptionId`, `purgeAfter` — and carries no
refusal and no request. Nothing about it is on any tier:
`grep -rniE 'askSession|/ask' docs/contracts/*.yaml | wc -l` → **0**.
🛑 **The nearest closed refusal vocabulary must not be borrowed.** `ReaderRefusal`
(`model/reconciliation.ts:3183`) has **8 arms** —
`awk '/^export type ReaderRefusal =/,/^export type _Reader/' model/reconciliation.ts | grep -cE "^  \| \{ kind:"`
→ **8** — and belongs to the reconciliation reader seam. Its nouns describe **one
residue row's counterparty**, not a question about a docket. The route bundle
borrowed them once and the borrowing was removed.
**Blocks:** `/ask` (every refusal and every in-flight state). **Ruled:** —

**MG26 · `CarriedTurn`'s containment proof is ONE LEVEL DEEP.**
✅ **RESOLVED 22 Aug 2026, #240 — AND THE ROW BELOW IS LEFT AS WRITTEN RATHER THAN
DELETED, because it is the finding and not the fix.** Both proofs now assert with
`AssertNoTextDeep`, G146's inverted allow-list of value-free leaves. Derive it:
`grep -n '_CarriedTurnHoldsNoText\|_CarriedReadingHoldsNoText' model/identity.ts`.
The ten escapes were **re-derived against the tree** — not copied from G146's row —
and each was witnessed REJECTED by the inverted form in a commit that landed
**before** the migration, because `Assert<never>` compiles and a vacuous proof
reads exactly like a real one. Both halves are executable in
`tests/model/carried-turn-containment.test.ts`, and the shallow form's ten
admissions are pinned there as types rather than as prose.
🛑 **WHAT IS STILL OPEN AND IS NOT THIS FILE'S TO CLOSE:** whether the migration
**amends G47** — whose ✅ rested on the weaker form — or is orthogonal to it. #240
§6 states the trade-off; the answer is the owner's, and no `G` row was edited.

**The finding, as it stood:** both proofs were `AssertNoPlainText`, not the deep
form — `export type _CarriedTurnHoldsNoText = AssertNoPlainText<CarriedTurn>` and
the same for `CarriedReading`. The mechanism is a top-level mapped type,
`type NoPlainText<T> = { [K in keyof T]: string extends T[K] ? never : T[K] }`
(`grep -n 'NoPlainText<T>' model/identity.ts`), which is still declared and now has
no call site in `model/`.

**Verified here by compiling a probe with `model/tsconfig.json`'s exact
`compilerOptions` and the tree's own `tsc` 5.9.3.** Four inputs; three pass and one
fails:

| Probe property | Verdict |
|---|---|
| `readonly rows: readonly { label: string }[]` | **PASSES** |
| `readonly tags: ReadonlySet<string>` | **PASSES** |
| `readonly describe: () => string` | **PASSES** |
| `readonly question: string` | **FAILS** — `TS2344: Type 'string' is not assignable to type 'never'` |

A set of strings is text. **`CarriedTurn` was not on G146's inverted allow-list** —
that inversion landed for `AssertNoTextDeep` (`model/reconciliation.ts:346`,
commit `77d7277d`) and `identity.ts`'s two proofs stayed on the shallow form for
twelve days after it. ⚠️ **Counted out of §4's shape**: the control existed and was
weaker than it read.
🛑 **THE PROHIBITION THIS ROW CARRIED IS LIFTED, AND ITS REPLACEMENT IS NARROWER
THAN THE SENTENCE IT REPLACES.** It read: *"Do not write a sentence claiming
`CarriedTurn` is proven to carry no text; claim only that it carries no bare
`string` property."* What may now be written: **both types are proven to hold no
value-carrying leaf the compiler cannot see through** — no bare `string`, no
container, no callable, no opaque object. What may still **not** be written: that
this is a claim about a runtime value. It is a claim about the TYPE, and nothing
here stops a `JSON.parse` result being asserted into one of these shapes at a
boundary. #217 [F-13]'s acceptance line — *"No copy anywhere claims a carried turn
is proven text-free"* — is the line this row's change reaches; it is stated here
and left for that issue.
**Blocks:** nothing further. **Ruled: G146** (for the deep form; `CarriedTurn`'s own
migration was ruled by nothing, and #240 built it under G146's sequencing).

**MG27 · No sharing field on `AskSession`, and no producer for the entity-set denominator.**
The six fields listed under MG25 include nothing about sharing. And no resolver
turns a `TagPolicy.legalEntityKey` (`model/domain.ts:1703`, on the interface at
`:1662`) into an entity-set **membership** — `/tags/resolve`
(`docs/contracts/foundation.openapi.yaml:608`, `resolveTags`) resolves tags by
precedence and yields a **cost centre**, which is a different question.
So the drawn *"sees 3 of 4 entity sets"* is **representable and not computable**:
the numerator has a home and the denominator has no producer.
**Blocks:** `/ask` (the sharing advisory). **Ruled:** —

### Reports — `/reports`

**MG28 · The Reports destination has no live model noun.**
Six nouns, zero exports between them:

```bash
for n in Report ReportDefinition ScheduledReport PinnedAnswer ExportJob ReportSchedule; do
  printf "%s: " "$n"
  grep -rhcE "^export (interface|type|const|function) $n\b" model/*.ts | awk '{s+=$1} END{print s}'
done
# Report: 0 · ReportDefinition: 0 · ScheduledReport: 0 · PinnedAnswer: 0 · ExportJob: 0 · ReportSchedule: 0
```

`close_period` **is** a capability (`model/access.ts:317`, classed `tenant_data` at
`:577`) with **no operation on any tier** —
`grep -rn 'close_period' docs/contracts/ | wc -l` → **0** — and no model noun
carries a close-pack acknowledgement. `model/presentation.ts` is
`@dropped-for-v1` **whole** (its banner at `model/presentation.ts:92`), so a pinned
answer has no destination on either end.
**Blocks:** `/reports` (most of it), `/ask` (⌘⏎ has nowhere to send an answer).
**Ruled:** the module drop is ruled; the destination is not.

**MG29 · No FX rate anywhere.**
`grep -rn 'FxRate' model/*.ts | wc -l` → **0**;
`grep -rn 'parseFxRate\|fxRate' model/*.ts | wc -l` → **0**.
G61's stamped consolidated total has nothing to stamp, and no per-disposition value
at risk can be drawn in a second currency. ⚠️ Note that `CLAUDE.md` names
`parseFxRate()` as the shape G67 demands — that is a **decision about a function
that does not exist**, not a citation.
**Blocks:** `/reports` (the consolidated total). **Ruled:** G61 and G67 rule the
shape; nothing rules the absence.

**MG30 · No retention schedule and no export approval.**
`RetentionPolicy` is declared at `model/domain.ts:1174`, and `days` has **exactly
one value in the whole tree**: `PLACEHOLDER_RETENTION_POLICY`
(`model/examples.ts:534`), thirteen classes at a uniform 365 from a single
constant, whose own docblock calls it a fixture. **A fixture is not a schedule**,
so there is no date to render.
And there is no export approval: `grep -rniE 'ExportApproval' model/*.ts` returns
nothing, while `DataEgressConfig.requireApprovalToExport` (`model/policy.ts:389`)
is a **boolean that refuses** — no approver field, and nothing to key an approval
to.
**Blocks:** `/reports` (the retention row, the export-approval row). **Ruled:** —

---

## 6. Two defects found in the tree while verifying — recorded, NOT fixed

🛑 **Neither was touched.** `model/` belonged to a concurrent pass in this working
tree at the time of writing, and editing another session's files to fix a comment
is exactly how a correction becomes a collision. **Both are recorded here for
whoever owns `model/` next.**

### 6.1 · `model/domain.ts:1185` asserts something `model/examples.ts:534` makes false

`model/domain.ts:1185` reads, verbatim:

> `⚠️ THIS EXISTS BECAUSE NOTHING IN `model/` CONSTRUCTS A `RetentionPolicy`.`

and the paragraph continues that `Record<K, V>` totality is enforced at a
construction site *"and there is none — so relaxing `days` to
`Partial<Record<RetentionClass, number>>` … would typecheck in silence."*

`model/examples.ts:534` is `export const PLACEHOLDER_RETENTION_POLICY: RetentionPolicy = {`
followed by all fourteen retention classes. **There is a construction site.**
⚠️ **Read *thirteen* until 23 Aug 2026**, when **G233** minted `held_work` as
the fourteenth for #238 and #239 together. The construction site is what caught
it: the fourteenth was a `TS2741` here and in `RETENTION_RECORD_KIND`, which is
the whole argument this paragraph is making. Derive it, never read it:
`awk '/^export const RETENTION_CLASSES/,/^}/' model/domain.ts | grep -cE '^  [a-zA-Z]'`

```bash
sed -n '1185p' model/domain.ts        # the assertion
sed -n '534p'  model/examples.ts      # the construction
```

⚠️ **This is not a cosmetic staleness.** The comment's *conclusion* is now wrong
too: with a construction site in the tree, narrowing `days` would **not** typecheck
in silence — it would fail at `examples.ts`. The compile-time proof the comment
justifies may now be redundant, or may not be; **that is a judgement for the module's
owner and is deliberately not made here.** This is `docs/HANDOFF.md` §5.11's shape:
a true sentence that a later commit made false, in a place no checker reads.
`tools/check-doc-counts.mjs` cannot see it — **there is no number in it.**

### 6.2 · A `file:line` citation inside `model/domain.ts` resolves to the wrong declaration

`model/domain.ts:3780` cites `AssignmentScope.valueCeiling` as `access.ts:673`.
`model/access.ts:673` is a line inside a **doc comment about role explosion**
(*"and role counts grow multiplicatively with the org chart"*). The declaration is
at `model/access.ts:722`, on the interface opening at `:679`.

```bash
grep -n "AssignmentScope.valueCeiling\` (\`access.ts" model/domain.ts   # 3780
sed -n '673p'  model/access.ts                                         # what it resolves to
grep -n 'valueCeiling: Money | null' model/access.ts                   # 722 (and 1410, a local)
```

⚠️ **The citation of the bad citation moved too, in the hour this was written** —
it was `model/domain.ts:3735` when first drafted. The `grep` above is printed
instead of the line number for exactly that reason.

**The citation RESOLVES to a line with real text on it**, which is why
`tools/check-citations.mjs` is silent: it flags a citation landing on a blank line,
a lone brace or a bare comment marker, and this one lands on a full sentence.
Reproduce the silence:
`node tools/check-citations.mjs | grep -c 'access.ts:673'` → **0**, with the tool
exiting **0**. Its own footer says so — *"a citation that drifted from one real
line to another real line is invisible here."*

This is the same class `CLAUDE.md` narrates six times on its own page, and it is
the first instance recorded **inside `model/`** rather than in a document.

---

## 7. Claimed and not reproduced

**Empty. All thirty reproduced.**

> ⚠️ **TRUE WHEN WRITTEN, AND NO LONGER TRUE OF THE COMMANDS AS PRINTED —
> 16 Aug 2026.** All thirty findings still hold as findings; **one row's headline
> command no longer produces the output printed beside it.** MG9's
> `grep -rniE 'admission_refusal|residue|control_total|postcondition'
> docs/contracts/` returned zero at this file's commit and returns **three
> matching lines** today. Two are comments that restate the finding; the third,
> `docs/contracts/control-plane.openapi.yaml:1722`, is a **real enum member**
> and narrows MG9's headline to the three tenant-facing tiers. §3.2 carries the
> full correction and the restated claim.
>
> **This is drift, not a failed reproduction** — the substance of MG9 is
> unchanged and is re-derived there. It is recorded here because a reader who
> runs a printed command and gets different output should find that fact in this
> file rather than discover it alone. **That is exactly what the G32 snapshot
> banner at the top predicts**, and it is the second protection in the list below
> working as intended: the command was printed with its output, so the drift was
> visible the moment someone re-ran it.

⚠️ **An empty section here is worth less than it looks, and the reason is worth
stating.** Every one of the thirty is an **absence**, and an absence is verified by
a grep returning zero — which is the easiest kind of claim to verify and the
easiest kind to get wrong by grepping for the wrong string. Three specific
protections were applied and a re-runner should apply them again:

1. **Every command is printed with its output**, so a zero that came from a typo in
   the pattern is at least visible.
2. **Where a loose grep and a precise grep disagree, both are shown** — MG18 is the
   worked example: the precise form returns 0 and the loose form returns 61
   matching lines of prose.
3. **`grep -c` is never read as a count of matches.** It counts matching lines, and
   the two rows where that distinction bites — MG17's `5` and MG18's `61` — say so
   in the row.

Two claims from the reporting pass were **narrowed rather than accepted**, and the
narrowing is the honest result rather than a reproduction:

- **MG9's commit count.** The pass said *"twelve commits of engine work"*. The
  derived figure is **13** commits touching `model/reconciliation.ts`
  (`git log --oneline -- model/reconciliation.ts | wc -l`), and **not all thirteen
  are engine work** — one is a docs commit and one is a module-count sweep. The
  finding does not depend on the number; **13** is stated because it is the one a
  command reproduces.
- **MG16's framing.** The pass reported the missing arm as a gap. It is verified as
  an absence and recorded as one, but the row now also carries **why the absence is
  correct** — the floor means *held and asked*, not *refused* — because a row that
  reads as a defect would invite someone to add the arm and break the design.
  ✅ **And that framing is what the closure turned on, 23 Aug 2026.** G227 kept
  `AdmissionRefusal` at seven and minted a residue cause instead. ⚠️ **That
  sentence is history and remains true as history: the union is at EIGHT now,
  because OQ-1 added `amount_not_exact_money`, which is not a floor arm and does
  not touch this reasoning.** **Had the row
  been left reading as a missing arm, the eighth arm is what would have been
  built** — it passes every *"the floor is enforced"* assertion and discards the
  value the floor exists to have looked at. This is the one place in this file
  where the framing of a gap changed the fix rather than describing it.

---

## 8. What this file cannot do

- **It has no owner and no maintenance.** Under G32 that is the point, and it is
  why the banner says snapshot in three places.
- **No checker governs any number in it.** `tools/check-doc-counts.mjs` derives
  fourteen governed totals from the tree; **not one of them is a count in this
  file.** The thirty, the twenty-six, the eight excluded rows, the sixty-seven
  paths — nothing but a person will catch any of them going stale.
- **It is blind in exactly the way the extractor is blind.** Several of these gaps
  were findable only because a screen was drawn against the tree. A missing type
  with an id-shaped name would have shown up in `docs/model-graph.json`; a missing
  *evaluator*, a missing *operation* and a missing *denominator* show up in
  neither the graph nor `tsc`. `docs/HANDOFF.md` §7 has the worked example.
- **It does not say what to build.** Eleven of the thirty are already ruled and the
  rulings are the authority. Of the nineteen that are not, some should stay open.
