# Prompt Injection — Our Posture

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** PARTIAL — the authority for the injection posture and its control set; it decides no product scope.
> This is the answer given to a customer's security reviewer, so it has to be current. **RULED 8 Aug 2026: it stays a LIVING CONTROL and was repaired the same day** — the alternative on the table was relabelling it a dated snapshot, which was rejected because the record would then have had no current answer for a security reviewer, and `PRODUCT.md` records the first non-demo customer as a regulated enterprise.
>
> **What the repair fixed, and the shape is worth more than the instances.** This banner previously said *"its residual risk R6 is closed by G47 and still reads as open here."* **That was wrong in a way the document itself refuted:** R6 read CLOSED at the end of §8. What actually read stale was the **pattern table in §8**, which called Context-Minimization *"Never considered"* — so the summary table a reviewer reads and the addendum a reviewer does not disagreed with each other, and the wrong one was the visible one. R6 has also been added to the §6 residual table, where it belonged and was absent. **A banner asserting a defect its own body disproves is `docs/HANDOFF.md` §5.4 one level up** — a claim asserted in a document that the document refutes.
>
> ⚠️ **STILL OPEN, and neither is a documentation problem.** **Invariant 6 has one of its two pack-publication enforcements running** — `validateProcedureInjectionSafety()` and `validateAgentToolBindings()` both need a call site that does not exist, and there is no `.github/` (`HANDOFF` §8 item 8). And **G9 is not applied**: verified 8 Aug at `agents.ts:949`, the trifecta test is still `b.tool === TOOL_KEYS.readCorrespondenceThread`, so **an agent bound to `endpoint_read` + `send_correspondence` passes the check today**, and `TOOL_ADMITS_UNTRUSTED_TEXT` exists nowhere in `model/`.
> *Banner added 8 Aug 2026; rewritten the same day when the ruling was taken.*

> **Status:** security posture record. 5 Aug 2026.
> **Audience:** a customer's security reviewer, and whoever has to answer them.
> **Scope:** every path where content we did not author reaches a model — vendor
> replies, ingested documents, connector payloads.

---

## 1. The position, stated plainly

**There is no fix, and we do not claim one.**

OWASP, on the top LLM application risk three years running:

> "Given the stochastic influence at the heart of the way models work, it is
> unclear if there are fool-proof methods of prevention for prompt injection."

Any vendor telling a security reviewer they have *solved* prompt injection is
either selling a detector or has not looked. The credible position is that the
risk is **contained architecturally** — by constraining what an agent can reach
and do — rather than **detected** in the content.

That is our position, and everything below is the containment.

---

## 2. What the field actually converged on

Two frames are worth knowing because a good reviewer will use them.

### 2.1 The lethal trifecta

An agent is exploitable for exfiltration when it has all three of:

1. access to **private data**,
2. exposure to **untrusted content**, and
3. the ability to **communicate externally**.

The mitigation is to break the *combination*. Filtering the content is not the
mitigation, because the malicious and legitimate forms are often identical —
*"please credit the difference to account 4471"* is an ordinary vendor sentence
and an injection, depending on who acts on it.

### 2.2 Architectural patterns, not filters

The recognised design patterns all constrain structure rather than inspect text:
action-selector, plan-then-execute, LLM map-reduce, dual-LLM, code-then-execute,
context-minimisation. The survey's conclusion is that general-purpose agents are
unlikely to offer *"meaningful and reliable safety guarantees"* through detection.

**CaMeL** (Google DeepMind) is the most developed: a *privileged* model that
plans and never sees untrusted content, and a *quarantined* model that processes
it and returns symbolic values the privileged model never reads directly.

### 2.3 On the detectors

Open-source and commercial screening models exist and publish very low false
positive and false negative rates. Treat those numbers carefully:

- benchmark performance against a fixed corpus is not performance against an
  adaptive attacker, and there is active research specifically on defeating the
  defence frameworks;
- a detector is a classifier, which is the approach OWASP declines to call
  fool-proof.

**Worth having as a layer. Never worth relying on.** We should not build the
architecture on the assumption that a screen catches things.

---

## 3. Our controls, mapped to the recognised set

| Recognised control | Our mechanism | Strength |
|---|---|---|
| **Plan-then-execute** | `Procedure` is a graph authored ahead of time and signed in a pack. Untrusted content can influence a branch predicate; it cannot add a step, change a tool scope, or alter the plan. | **Strong.** This is the single most valuable property we have, and it came free from the harness design. |
| **Privilege control** | Per-step `toolScope`; `EffectivePolicySet` evaluated at every step; agent may propose but execution is separately gated. | Strong |
| **Deterministic output validation** | An agent returns a `dispositionKey` from the pack's closed list, and a `Money` adjustment. Not free text — validated in code against the archetype's families. | Strong |
| **Human-in-the-loop for privileged actions** | `human` steps, `secondApproverAbove` money thresholds, `AutonomyConfig` defaulting to `none` in KYC. | Strong |
| **Quarantine / dual-LLM** | `admittingAgentMayCarryTools: false` — an agent may admit inbound content only from a step with an empty tool scope. The agent that admits is never the agent that acts. | **Partial.** We have the isolation; we do not pass symbolic values. The admitted text reaches the resolution agent verbatim. |
| **Segregate untrusted content** | `MessageTrust.untrusted_inbound` is carried on every message and recorded at admission. | **Partial.** The field exists; the prompt-assembly *mechanism* — delimiting, spotlighting, provenance framing — is asserted in comments and not modelled. |
| **Context minimisation** | — | **Absent.** |
| **Adversarial testing** | `Scorer`, `SeededExample`, `EvaluationGate` exist and gate promotion. | **Partial.** No injection-specific corpus. |

### 3.1 The control that is genuinely ours

**A message is not evidence until admitted.** `admittedAsEvidenceAt` null means
the message may be stored, displayed and audited, but may not be cited in a
proposal, fed to an agent as grounds, or resume a parked `await` step. Its
attachments do not become documents.

Admission is governed by `mayAdmit()`: a minimum role (default `operator`), an
agent ceiling by data class, a second person above a class, and the empty
tool-scope requirement. Refusals use a closed vocabulary so they survive a
restrictive span-attribute policy.

---

## 4. The gap we found, and the rule that closes it

The admitting agent has no tools, so it cannot exfiltrate. **But the trifecta
reassembles one step later.** The resolution agent reads the now-admitted reply,
holds the exception data, and sits in a procedure that can reach a `notify` step.
Private data, untrusted content, external communication — all three, one actor.

Partial mitigations already existed: the outbound classification ceiling, a
`DisclosureRecord` per send, and refusal to send to an unverified endpoint. So an
injected instruction cannot send arbitrary content to an arbitrary address. That
is meaningfully better than nothing and it is **not** the same as breaking the
combination.

**The rule, added 5 Aug:**

> From any step where free-form untrusted text enters, **every path to an
> outbound notification must pass through a human step.**

`validateProcedureInjectionSafety()` checks it by graph reachability, and it runs
**when a pack is signed, not at runtime** — the same discipline as the archetype
constraints, because a rule that only fires in production is a rule that ships
broken.

Scoped deliberately to `counterparty_reply`. Extracted document values also come
from outside, but they are constrained by `FieldSpec` and typed as scalars,
whereas a reply is unbounded prose written by someone who may want something.
Widening the rule to all extracted data would make it unsatisfiable, and an
unsatisfiable rule gets switched off.

---

## 5. "Can we just clean the data before it arrives?"

Raised 5 Aug: *it is cheaper to have clean data than to use models to remediate.*
**That is two questions with opposite answers**, and separating them is the whole
of this section.

### 5.1 Sanitising against injection — no, and here is why

You cannot strip instructions from prose, because there is no syntactic marker
for one. The malicious and legitimate forms are the same sentence. Anything that
tries is a classifier, and §2.3 applies. Worse, stripping destroys the evidence
value — the reason to read the vendor's reply is *what it says*.

**But a deterministic, cheap, no-model subset genuinely helps**, and we should
build it. It does not stop a determined injection; it removes the entire class of
non-text vectors and every low-effort attempt:

| Control | Why |
|---|---|
| Strip active content | HTML, script, macros, embedded objects, remote images — the last is both a tracking and an SSRF vector |
| Normalise encoding | Zero-width characters, homoglyphs, bidirectional overrides, base64 blobs in the body |
| Flatten to plain text for the model | Keep the original blob as evidence; the model reads the flattened form |
| Strip document metadata | PDF and Office metadata fields are read by extraction and seen by nobody |
| Structural rejection | Macro-bearing attachments, executables, unexpected MIME types — quarantine, do not parse |
| **Sender authentication** | SPF, DKIM, DMARC. Deterministic and cheap, and it is exactly the existing `sender_unverified` refusal reason |
| Size and nesting limits | Zip bombs, deeply nested archives, absurd page counts |

All of it belongs in the isolated intake parser — **no credentials, no network
egress, no database reach** — which the systems design already requires.

### 5.2 Data quality — yes, entirely right, and it is a cost lever

**The cheapest document to extract is the one you never extract.** Ranked:

| Fidelity | Path | Cost | Error possible? |
|---|---|---|---|
| **Structured** — Peppol, EDI, source-system API | Parsed | Near zero | No |
| **Tabular** — CSV or spreadsheet on a known mapping | Parsed | Near zero | No |
| **Digital text** — PDF with a text layer | Model reads layout | Moderate | Yes |
| **Scanned** — an image | OCR **and** a model | Highest | Yes, and hardest to detect |

This is now in the model: `DocumentType.expectedFidelity` and
`SourceDocument.actualFidelity`. The **gap between them** predicts extraction cost
and error rate better than anything else we hold — and invoices that were
structured last quarter and scanned this one are a *supplier* problem, not a
model-tuning problem. The two need entirely different responses, and today
nothing would have told them apart.

Three consequences worth stating:

1. **Extraction should branch on fidelity, not run one pipeline.** Structured and
   tabular are parsed; only digital-text and scanned reach a model. Building one
   pipeline that always calls a model is the expensive mistake.
2. **It shrinks the injection surface too** — but does not close it. A structured
   invoice still carries free-text description and remark fields that a model
   reads. It collapses the surface from *the whole document* to *named fields we
   can classify and constrain*, which is a large improvement and not an escape.
3. **Singapore matters here.** Structured e-invoicing is arriving through
   InvoiceNow / Peppol on a phased GST mandate. For finance customers in this
   market, a meaningful share of invoices will become `structured` whether or not
   we plan for it. Planning for it makes it a cost saving; not planning for it
   makes it a migration. ⚖️ Confirm the current mandate scope and dates before
   any of this is said to a customer — the phasing has moved before.

### 5.3 The honest limit

Clean data helps the **document** path enormously and the **correspondence** path
not at all. You cannot Peppol a human explaining why they shorted a delivery, and
that conversation is where the product's value is. So: pursue structured intake
hard for cost and accuracy, and expect the injection surface to remain exactly
where it is.

---

## 5.4 Where these controls live

Working out the component homes on 5 Aug found three controls with no service to
own them, and one being enforced by the component it constrains. All three are
now in `docs/component-architecture.html`.

| Control | Home | Note |
|---|---|---|
| Admission gate | F3 Policy Engine, called by C9 | — |
| Three classification ceilings | F4 Classification | — |
| Disposition from a closed list | C10 Resolution | Validated against pack data |
| Residency on model calls | F7 Model Gateway | The only path to an LLM |
| **Deterministic intake hygiene** | **F12 Content Sanitisation** (new) | Two callers — C1 and C9 — so it is foundation, not a helper inside intake |
| **Tool scope** | **F13 Tool Broker** (new) | ⚠️ Was enforced by C8, the agent runtime, which is Mastra. A component must not enforce its own limits, and our boundary must not live in third-party code |
| **Procedure validation** | **F14 Authoring Validator** (new) | ⚠️ Ran only at pack signing. Tenant-authored procedures are never packed and never signed, so they crossed no gate at all |

### The six authoring gates

Enforced in F14 **at the point of persistence**, never in the builder interface —
a check in a UI is bypassed by the first caller who uses the API.

1. **Structural** — step kinds from the closed catalogue, edges resolve, a
   `branch` has exactly one true and one false edge.
2. **Capability** — every `toolScope` entry is in the pack's catalogue; every
   `dispositionKey` sits in a family its archetype allows.
3. **Injection safety** — `validateProcedureInjectionSafety()`.
4. **Policy fit** — a step needing autonomy the tenant forbids is warned, not
   rejected; policy legitimately changes.
5. **Evaluation** — scorers and gates pass, including the adversarial corpus
   once R3 is closed.
6. **Attest or sign** — packs signed over the graph; tenant procedures stamped
   with graph hash, validator version and timestamp.

**There is no separate agent object to secure.** An agent is an `agent` step
inside a procedure, so creating one is editing a graph and crosses all six gates
automatically. One authoring path, one security model.

---

## 6. Residual risks, recorded

| # | Risk | Status |
|---|---|---|
| R1 | **The admitted message reaches the resolution agent verbatim.** We isolate the admitting agent but do not pass symbolic values as CaMeL does. | Open. Full dual-LLM is a larger change than it looks. |
| R2 | **No prompt-assembly mechanism is modelled** — delimiting and provenance framing are described in comments, not enforced by a type. | Open. |
| R3 | ~~No injection corpus in evaluation~~ | **Closed 5 Aug.** `InjectionProbe` + `InjectionGate` in `model/evaluation.ts`. Not a `SeededExample`: a probe asserts an **absence**, and there is no partial credit. `waivable: false` in every environment. A live failure returns `compliance_violation`, deliberately bypassing the scorer-level rollback rule. |
| R4 | **Branch predicates read untrusted values.** The graph cannot be altered, but a `branch` can be steered by a value an attacker controls. Bounded — it can only choose among authored paths — and not zero. | Accepted, recorded. |
| R5 | **Connector payloads are untrusted too.** The rule is scoped to counterparty replies; a compromised supplier portal is a comparable surface with no equivalent gate. | Open — and **worse since 7 Aug 2026**, see below. **G45 is its construction-level fix and is a v1 prerequisite under G62.** |
| R6 | ~~**Context-Minimization is not applied**~~ | ✅ **Closed 7 Aug 2026, G47.** Full reasoning at the end of §8. ⚠️ **Listed here from 8 Aug 2026 onward** — it had been recorded only in a §8 addendum, so this table, which is the one a reviewer reads, was missing a residual risk entirely. |

> **⚠️ R5 GOT A TYPED LANDING PLACE ON 7 Aug 2026 AND NO GATE.** `EndpointReading`
> (`model/domain.ts`, G42) is a connector payload as a first-class model row:
> `label` and `value` are text a foreign system returned, they ground a proposed
> write back into that same system, and a human reads them on a card captioned
> *"read from SAP · 4s ago"*. Three specific things are absent, and they are
> written at the declaration rather than left to this table:
>
> 1. **`TOOL_ADMITS_UNTRUSTED_TEXT` does not exist.** G9 decided the
>    injection-safety rewrite lands as ONE change at three sites
>    (`domain.ts:1409-1413`, `:1432`, `agents.ts:949` — re-derived 7 Aug 2026; the three previously recorded here were dead) and it is **not applied**, so
>    the predicate that would classify `endpoint_read` as a source of untrusted
>    text is simply not there. Landing the entry-set fix alone makes the rule
>    unsatisfiable for every OCR procedure, which is why it is one change.
> 2. **The trifecta rule does not fire on this path**, concretely and today.
>    `validateAgentToolBindings()` decides "reads untrusted text" by testing
>    `b.tool === TOOL_KEYS.readCorrespondenceThread`, then refuses an `egress`
>    effect alongside it. **An agent bound to `endpoint_read` +
>    `send_correspondence` passes.** That is §5.1's shape — a rule keyed on a
>    convenient landmark instead of the property it cares about — and it is the
>    landmark G9 exists to replace.
> 3. **There is no admission act on this path at all.** `Endpoint`'s own header
>    already records that *"a connector-pulled document reaches extraction with
>    no admission act"*; this adds a connector-pulled **value** reaching a
>    **proposal to write to the ledger**, on the same footing.
>
> Nothing here is new risk that G42 created — the connector path was always
> untrusted. What changed is that it is now a named type with a doc comment
> saying so, which makes the gap findable instead of implicit.

---

## 7. What a security review will ask, and the answer

**"How do you prevent prompt injection?"** — We don't, and neither does anyone;
here is the OWASP position. We contain it: the plan is authored and signed ahead
of time, tools are scoped per step, output is validated against a closed set,
inbound content is not evidence until admitted, the admitting agent carries no
tools, and no automated path reaches an outbound message without a human.

**"What if the model is tricked anyway?"** — The blast radius is the union of one
step's tool scope and the outbound classification ceiling. It cannot add a step,
widen its own scope, reach tenant data outside the run, or send to an unverified
endpoint.

**"Show me."** — `validateProcedureInjectionSafety()` at pack signing,
`mayAdmit()` at admission, `DisclosureRecord` per outbound message, and
`DataAccessEvent` for everything read. All four are checkable after the fact.

---

## Sources

- [OWASP GenAI — LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Design Patterns for Securing LLM Agents against Prompt Injections](https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/)
- [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- [CaMeL — Defeating Prompt Injections by Design](https://simonwillison.net/2025/Apr/11/camel/)
- [The Dual LLM pattern](https://simonwillison.net/2023/Apr/25/dual-llm-pattern/)
- [Taxonomy, Evaluation and Exploitation of IPI-Centric LLM Agent Defense Frameworks](https://arxiv.org/pdf/2511.15203)

---

## 8. The named patterns, and which ones we already implement

Added 7 Aug 2026, after a debate about whether ERP reads carry injection risk. The
short answer is that the field has settled positions and this document had been
deriving them from first principles without citing them.

**Beurer-Kellner et al., *Design Patterns for Securing LLM Agents against Prompt
Injections*** (arXiv:2506.08837). Its thesis, verbatim:

> *"Once an LLM agent has ingested untrusted input, it must be constrained so that
> it is **impossible** for that input to trigger any consequential actions."*

And: securing *general-purpose* agents is impractical. Build **application-specific**
agents with intentionally limited capabilities.

| Pattern | Definition | Status here |
|---|---|---|
| **Action-Selector** | The LLM is a switch over predefined tool calls | ✅ **Built.** The closed tool vocabulary with `TOOL_EFFECT` total over it; `dispositionKey` from a pack's closed list; output validated against a closed set |
| **Plan-Then-Execute** | A fixed plan is formed before untrusted data; tool output cannot alter it | ✅ **Built — this is what `Procedure` is.** A pack-authored graph, signed, validated at signing time. §7 already said it in the paper's words: *"the plan is authored and signed ahead of time"* |
| **Dual LLM** | Privileged LLM handles planning and tools; quarantined LLM processes untrusted data **via symbolic references only** | 🔨 **Decided, not built — G45, and it is now a v1 PREREQUISITE rather than a later hardening.** G62 ships `Ask` as drawn, and `Ask` reads live foreign-system text and proposes ledger writes **in the same turn** — so G47 stopping text at a TURN boundary is not enough; G45 is what stops it crossing the AGENT boundary within one turn. The reader holds no write capability and emits symbolic references; the proposer never sees ERP text. This is R1's fix at the scale we need it, and until it lands R5 below is mitigated by argument rather than by construction |
| **LLM Map-Reduce** | Isolated instances per data item, aggregated without an LLM | ➖ Not applicable — our reads are single-item |
| **Code-Then-Execute** | The agent emits formal code rather than natural language | ➖ Refused implicitly. `Procedure` is the plan language and a pack cannot add a step kind |
| **Context-Minimization** | User prompts are removed from context after translation to actions | ✅ **Built — G47, 7 Aug 2026.** ⚠️ **This row read *"Never considered"* until 8 Aug 2026, while R6 below recorded it CLOSED.** The document contradicted itself, and this is the table a reviewer reads. `CarriedTurn` holds no `string` field: the question, the answer and the reading text all stop at the turn boundary; ids and numbers cross. `_CarriedTurnHoldsNoText` makes putting any of it back a compile error. See R6 |

### The convergence worth recording

The paper names Plan-Then-Execute's limitation as *"cannot prevent parameter-level
injections."* That is **residual R4 of this document, arrived at independently**:
*"branch predicates can be steered by attacker-controlled values."* We found the known
weakness of the pattern we were using, without knowing it was the known weakness.

### The security argument for dropping the agent builder

Recorded here because it is a security argument and it was taken as a scope one.

The paper's thesis is that general-purpose agents cannot be secured and
application-specific ones can. **G-pass v1 dropped the agent builder for speed; it
also moved the product toward the one architecture the literature says is
defensible.** That is the answer when a prospect asks why customers cannot author
their own agents — not "we ran out of time", but "an agent whose capabilities a
customer can widen is an agent nobody can bound."

### R6, new

| # | Risk | Status |
|---|---|---|
| R6 | ~~**Context-Minimization is not applied**~~ | **Closed 7 Aug 2026, G47.** `CarriedTurn` (`model/domain.ts`) is what the model sees of a prior turn, and it holds NO `string` field: the operator's question, the agent's answer and the reading text all stop at the turn boundary; proposal ids, reading ids and numbers cross. That is the pattern — untrusted content removed once translated into actions, and the actions are what survive. `_CarriedTurnHoldsNoText` asserts it structurally, so putting the question back is a compile error rather than a review conversation. `AskTurn` deliberately keeps everything: it is the TRANSCRIPT and a human reads it. G46's window still bounds how many turns carry; this bounds what each may contain. |
