# GREEN — the mapper seam, and the containment proof on the REQUEST path

**Controls C9, C10, C11, C12 of the adjudication, made buildable.**
*9 Aug 2026. Analysis and design only: no file in `/Users/jrkphani/Projects/Reconcile` was
created, edited or deleted, and no git command other than `git show` was run.*

> ⚠️ **NOTHING BELOW HAS BEEN COMPILED.** Every declaration in §2 is design. I did not run
> `tsc`, I did not write the file, and I therefore cannot claim `EXIT: 0` for any of it.
> Where I claim a proof holds or fails I say which mechanism makes it so and cite the line
> in the tree that already exercises that mechanism — that is evidence about the mechanism,
> not about my code. §5 is the RED plan whoever builds it must actually run.

Every `file:line` below was opened in this session. Counts were derived with the command
shown, never quoted from prose.

---

## 0. THE FOUR SENTENCES THIS DESIGN EXISTS TO MAKE MECHANICAL

1. **A mapping proposal reads KEYS and SHAPE. It never reads a VALUE.** (R1)
2. **One request carries exactly one untrusted column header, and there is no plural arm** —
   so the TYPE enforces what the fan-out enforces at runtime. (G120's answer to red-team F1)
3. **What crosses back is an index into a vocabulary we supplied — never a key name, never a
   format string, never a pattern, and never an `IdentifierNormalisation`.** (R3, G124, G130)
4. **The seam is a TYPE the caller fills, it has no executor, and it says so on itself.**
   (G118)

---

## 1. WHAT ALREADY EXISTS THAT THIS REUSES

Verified, this session, at `HEAD` = `f988f2a4`.

| # | Existing thing | Where | What I reuse it for |
|---|---|---|---|
| 1 | `AssertNoTextDeep<T>` and its `NoTextField` / `NoTextDeep` machinery — **exported** | `model/reconciliation.ts:248-258` | Every containment proof below. **Nothing is re-declared.** |
| 2 | The note that the `T extends string ? T` arm is load-bearing *"without it a branded `Id<'X'>` recurses into `String`'s own method signatures and the SAFE case fails"* | `model/reconciliation.ts:240-247` | Why a branded `SourceDocumentId` / `ContentDigest` **passes** the deep proof while a plain `string` fails it. Same paragraph records that re-pointing the proof is *"its own change with its own red run — diff-plan DP-8"* — which is why §2 imports it rather than moving it to `kernel.ts`. |
| 3 | `ReaderRequest` — singular `untrustedDescription`, no plural arm | `model/reconciliation.ts:2194-2202` | The shape of `MapperRequest`, one request per column. |
| 4 | `ReaderCandidate` — *"One candidate the PRIVILEGED side offers. The model may name it only by index"*; `ref` is **not** put in the prompt | `model/reconciliation.ts:2179-2192` | The shape of `MapperCandidateField`, and the rule that the returned index is resolved on our side. |
| 5 | `ReaderVerdict` (four arms) + `_ReaderVerdictHoldsNoTextDeep` + its **"VERIFY IT RED BEFORE TRUSTING IT GREEN"** block naming the two tempting edits | `model/reconciliation.ts:2227-2246` | The shape of `MapperVerdict`, its assertion, and the form of §5's red plan. |
| 6 | `ReaderRefusal` (eight arms) + `_ReaderRefusalHoldsNoText` | `model/reconciliation.ts:2269-2281` | Seven refusal arms shared verbatim, tied to the reader's spelling by a two-sided assertion (§2.9) instead of copied. |
| 7 | `ReaderTokenUsage`, and its comment on being **deliberately not asserted** because `providerRequestId` *"IS a plain string"* | `model/reconciliation.ts:2283-2305` | Reused unchanged as the mapper's usage type. The name is a wart; a second copy would be §5.3. |
| 8 | `MeterFact` and `tokenMeterFacts(usage)` — provider-reported only, `${providerRequestId}#${meter}` idempotency key | `model/reconciliation.ts:2548-2574` | The mapper's fan-in emits token facts through **this** function. It reads nothing reader-specific: verified, its whole body is `usage.inputTokens` / `usage.outputTokens` / `usage.providerRequestId` / `usage.modelEntryId`. |
| 9 | `notImplementedReader` — *"THE UNIMPLEMENTED SIDE OF THE SEAM. THIS IS A STUB AND IT SAYS SO … returns a REFUSAL, not a fabricated value"* | `model/reconciliation.ts:2352-2371` | `notImplementedMapper`, same posture, same argument. |
| 10 | `applyReaderVerdicts` — *"THE INDEX BOUNDS CHECK IS THE CONTAINMENT ENFORCEMENT POINT … converted to a refusal and NOT to a lookup"* | `model/reconciliation.ts:2439-2510` | `applyMapperVerdicts`, with **two** indices to bounds-check instead of one. |
| 11 | `ItemRef { sourceDocumentId; lineIndex: number \| null }` | `model/reconciliation.ts:785-789` | Sample-row provenance. **No `SampleRowRef` is minted** — a sample row is a line of one `SourceDocument`, which is exactly this type's currency. |
| 12 | `ObservedScopeValue<T>` — `observedOn` **required-and-nullable**, refused at runtime, *"Non-nullable would put the entire control in the COMPILER — and a nomination arrives as JSON over a wire the compiler does not run on"* | `model/learning.ts:478-510` | The polarity of `observedOn` on a mapping entry, and the argument for it, verbatim in shape. G131. |
| 13 | The branded-**value** idiom: module-private `declare const … : unique symbol` + `string & { readonly [sym]: 'X' }` | `model/learning.ts:404-413`, `:473-474` (`NormalisedDescriptionValue`) | `ContentDigest` and `HeaderSetHash` — derived strings, not rows, so **not** `Id<>`. This is the 9 Aug dangling-brand correction applied prospectively instead of repeated. |
| 14 | `IdentifierNormalisation`, `ExtractionOp`, `EXTRACTION_OP_KINDS`, `validateNormalisation()` | `model/reconciliation.ts:339-435` | **Reused unchanged by the FDE at promotion, and NOT importable by this module.** R3's stricter half is enforced by not importing them (§2.11). |
| 15 | `IdentifierNormalisation.maxInputChars`'s own sentence: *"a bound with no number is not a bound (§5.6) … It is never silently unbounded, which is the outcome a default would produce"* | `model/reconciliation.ts:379-387` | The polarity of every bound in `IngestBound` (§2.3). |
| 16 | `ACQUISITION_FIDELITY` / `AcquisitionFidelity`, with `tabular` defined as *"CSV or spreadsheet against a known column mapping. Parsed."* | `model/domain.ts:1782-1793` | The ladder this seam makes real. No fifth tiering is coined. |
| 17 | `FieldSpec` — `path`, `dataType`, `dataClass`, `modelProcessingAllowed`, `confidenceFloor` | `model/domain.ts:1717-1765` | The candidate set is built **from** `DocumentType.fields` (`:1800`). Invariant 4's declaration site is not duplicated. |
| 18 | `ExtractedScalar` — `text \| number \| date \| money \| identifier \| absent` | `model/domain.ts:1821-1827` | `CodecTarget = Exclude<ExtractedScalar['kind'], 'absent'>`. The codec's target vocabulary is the **parse output's own** vocabulary. |
| 19 | `DataType` | `model/domain.ts:645` | `MapperCandidateField.dataType`, and the one place the `'string'`/`'text'` divergence is reconciled (§2.7, and finding F-1 in §7). |
| 20 | `Assert<T extends true>` as a module-local one-liner | `model/reconciliation.ts:165` | Re-declared locally, exactly as that module did — it is not exported and a one-line type helper is not a vocabulary. |
| 21 | `_SetDispositionsAreDeclaredFamilies` — restate locally **plus** an assertion, *"the §5.3 mitigation applied to the one place a value import was not available"* | `model/reconciliation.ts:190-192` | The pattern for tying my refusal vocabulary to the reader's (§2.9). |
| 22 | `LearnedDisposition = Exclude<SetDisposition,'write_off'>` and its `@ts-expect-error` control that *"bites in BOTH directions — an unused directive is itself an error"* | `model/reconciliation.ts:3044-3054`, `tests/model/learned-dispositions.test.ts:388-394` | The negative proofs in §5 that pin an exemption so it cannot silently grow. |
| 23 | `REQUIRES_ENUMERATION` | `model/governance.ts:497` | C15's enumerated probe. No new access machinery; not my area, but `ObservedSchema.sourceDocumentId` is the field that makes the enumeration expressible. |
| 24 | `resolveManagedService()` | `model/policy.ts:1781` | Not called from here. Named so nobody reads this seam as the tier-4 gate. |

**The one thing I add to the tree's stock of machinery**, argued in §2.5: a
**bounded numeric character-class index**. Nothing existing expresses it —
`Normaliser` (`model/domain.ts:441` region, used at `MatchKey.normaliser`) canonicalises a
whole value, `ExtractionOp` (`model/reconciliation.ts:348-353`) transforms one, and neither
describes the *shape* of one without carrying it.

### 1a. The claim in C9 that *"nothing in the tree does this today"* — verified, and it needs one correction

Derived:

```bash
grep -rn "AssertNoTextDeep\|AssertNoPlainText" model/*.ts | grep -v '^\S*: \*'   # 15 assertion sites
```

**Thirteen deep assertions, all in `model/reconciliation.ts`, and every one is on a
RETURN-path type:** `MoneyRefusal` `:284` · `NormalisationDefect` `:397` ·
`ExtractionRefusal` `:444` · `ToleranceRefusal` `:701` · `AdmissionRefusal` `:856` ·
`AllocationRefusal` `:1278` · `ResidueCause` `:2098` · `ReaderVerdict` `:2246` ·
`ReaderRefusal` `:2281` · `SetReconciliationRefusal` `:2638` · `PostconditionFailure`
`:2648` · `LearnedRuleDefect` `:3117` · `LearnedProposalOutcome` `:3196`.

**`AssertNoTextDeep` is applied to no request type anywhere.** `ReaderRequest` is not
asserted and could not be: it carries `untrustedDescription: string` (`:2198`).

⚠️ **The correction: the SHALLOW proof already guards a request-path type.**
`_CarriedTurnHoldsNoText = AssertNoPlainText<CarriedTurn>` (`model/identity.ts:1189`) and
`CarriedTurn` is *"what the model sees of a prior turn"* (`:1109`) — i.e. prompt input. So
the accurate sentence, and the one the module header should carry, is:

> **The DEEP proof has never been applied to anything on the way IN. The shallow one has,
> once, to `CarriedTurn` — and shallow is not enough here, because a `ColumnProfile` is a
> nested structure and `NoPlainText` (`model/identity.ts:1139`) does not recurse: a
> `readonly string[]`, a nested `{ v: string }` and a `Record<string,string>` all pass it
> (`model/reconciliation.ts:234-238` says so in the tree's own words).**

C9 as written is right in substance and one word loose. Do not repeat *"nothing in the tree
has a containment proof on the request path"* without the word **deep**.

---

## 2. THE DESIGN

**FILE: `model/ingestion.ts` — NEW. The nineteenth module.**

### 2.0 Why a new module, and the §5.3 defence

§5.3 (`docs/HANDOFF.md:1532-1580`) is *"two vocabularies for one concept, diverging"*, and
its own tell is stated at `:1579-1580`: **"the same noun appearing in two modules with two
spellings of its value set. Grep for the values, not the type name."** The test is therefore
about **value sets**, not about file boundaries. Applying it honestly:

**What I do NOT mint a second of** — each of these is the *same noun*, so each is imported
or referenced, never re-spelled:

| Noun | Single owner | Where I would have duplicated it and did not |
|---|---|---|
| the deep no-text proof | `model/reconciliation.ts:258` | `import type { AssertNoTextDeep }` |
| provider-reported token counts | `ReaderTokenUsage` `:2300` | reused with its reader-flavoured name |
| a meter fact | `MeterFact` `:2548`, `tokenMeterFacts` `:2558` | the one value import |
| a row address | `ItemRef` `:785` | provenance uses it |
| the extracted-value vocabulary | `ExtractedScalar` `model/domain.ts:1821` | `CodecTarget` is `Exclude<>` of it |
| a field's declaration | `FieldSpec` `model/domain.ts:1717` | candidates are built from it |
| the fidelity ladder | `ACQUISITION_FIDELITY` `model/domain.ts:1782` | not re-tiered |
| identifier canonicalisation | `IdentifierNormalisation` `:374` | **not imported at all** (R3) |
| the DataClass ordering | see below | **not implemented here at all** |

⚠️ **The `DataClass` ordering is the sharpest case and it is why the module refuses to rank.**
`model/policy.ts:1693-1706` records, in the tree, that there are already **four** copies —
`DATA_CLASS_LADDER` (`model/policy.ts:1705`), `DATA_CLASS_RANK` (`model/learning.ts:1773`,
`@dropped-for-v1`), a function-local `order` inside `mayAdmit()` (`model/policy.ts:1088`),
and the rank the comment itself counts — and that unification *"is owed, as its own commit,
with `mayAdmit()` under test first."* A fifth would be indefensible. **So this module never
compares two `DataClass` values.** It carries the operand on the request and refuses when it
is absent; the caller, who owns the ladder, does the comparison — exactly as
`ReaderRequest.untrustedDescriptionClass` is *"Checked against
`ModelUseConfig.maxDataClassInPrompt` BY THE CALLER"* (`model/reconciliation.ts:2199`).

**What is genuinely new, by the adjudication's own standard** (*"these are genuinely new and
that is NOT §5.3, because `<existing thing>` expresses neither"*):

- **`ColumnProfile` / `ObservedKey` / the character-class skeleton.** Nothing in `model/`
  describes the shape of a value without carrying the value. `Provenance`
  (`model/domain.ts:1811-1815`) is page/box/confidence about an already-extracted value;
  `ExtractedScalar` **is** the value. Neither expresses a projection.
- **`ValueCodec` / `DateFormat` / `DecimalConvention`.** `Normaliser` canonicalises an
  identifier for keying; a codec **decodes a lexeme into an `ExtractedScalar`**. Different
  act, different direction, different output type. The adjudication rules the same at C11.
- **`SampleSelection` and deterministic spread selection.** Nothing samples anything anywhere
  in `model/`; `MAX_ENUMERATED_PER_DIMENSION = 25` (`model/learning.ts:770`) caps a
  human-authored list and is not a sampler.

**Why not put it in an existing module.**

- **Not `model/reconciliation.ts`.** Its own header defines its scope: *"WHAT THIS MODULE IS.
  The executable half of the `set_reconciliation` archetype"* (`:4-7`), and *"THE ENGINE HAS
  NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO NETWORK"* (`:80`). Ingestion runs **before** any
  population exists and is governed by a capability the engine has nothing to do with
  (`promote_field_mapping`, C14). Adding it would make that header false, and the file is
  already 3,405 lines (`wc -l model/reconciliation.ts`).
- **Not `model/domain.ts`.** 4,335 lines of entity declarations. `SchemaMappingProposal` is an
  entity, but `selectSample()` and `applyMapperVerdicts()` are total functions, and domain.ts
  has no executable machinery of that kind.
- **Not `model/policy.ts`.** It owns the ceilings and the ladder. Putting a *seam* there would
  put the thing being governed inside the governor.

**The direction of the new import edge, stated because it is load-bearing.**
`model/ingestion.ts` → `model/reconciliation.ts` is **type-only for four names and value for
one** (`tokenMeterFacts`). Type-only specifiers are erased under `verbatimModuleSyntax`
(`model/reconciliation.ts:36-39` records the loader consequence), so the only runtime edge is
`import { tokenMeterFacts } from './reconciliation.ts'` — **with the `.ts` extension**, per
`CLAUDE.md`'s value-import rule and `tests/model/runtime-importability.test.ts`. There is no
cycle: `reconciliation.ts` does not and must not import `ingestion.ts`.

🛑 **The right long-term home for `AssertNoTextDeep` is `model/kernel.ts`** — it needs no
imports at all, and kernel's rule is *"every branded id needs exactly one home"* for exactly
this reason. **Do not move it in this commit.** `model/reconciliation.ts:244-247` records that
re-pointing the proof is a change with its own red run (DP-8), and moving it would touch
thirteen live assertion sites. Import it; leave the move as its own commit.

### 2.1 The module header — ready to paste

`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals` all apply. Insertion point: a new file, top.

```ts
/* ==================================================================== *
 * INGESTION — the observation, the mapper seam, and the sampling
 *
 * WHAT THIS MODULE IS. The types and total functions of source onboarding: what
 * a deterministic probe OBSERVED about an artefact, the SEAM a schema mapper
 * fills, and the DRAFT ENTRIES a human is asked to promote. It is the vehicle
 * that makes `ACQUISITION_FIDELITY.tabular` (`model/domain.ts:1785`) real —
 * that member is defined as "CSV or spreadsheet against a KNOWN COLUMN MAPPING",
 * so the mapping is a PRECONDITION of the tier and never a product of a run.
 *
 * 🛑 THE SEAM HAS NO EXECUTOR. G118, INHERITED WORD FOR WORD FROM THE READER.
 * `notImplementedMapper` is the only implementation of `SchemaMapper` in this
 * repository and it REFUSES. No document may describe ingestion as having a
 * schema-mapping path until an executor exists. A typed seam plus a
 * compile-time containment proof reads to a newcomer as a shipped feature —
 * that sentence is G118's own warning and it is repeated here because the
 * conditions that produced it are identical.
 *
 * 🛑 THE ONE SENTENCE THIS MODULE EXISTS TO MAKE MECHANICAL — R1.
 *   A MAPPING PROPOSAL READS KEYS AND SHAPE. IT NEVER READS A VALUE.
 * An unmapped key's NAME, POSITION and locally-derived SHAPE are readable. Its
 * VALUE is not, and no authorisation makes it so for this purpose. That is not
 * an exception to G106 — G106's load-bearing half is that an unmapped key is
 * "stored but unaddressable by any agent, prompt, export or dashboard", and a
 * column header is the NAME OF A SLOT, not an `ExtractedValue`. G106's rejected
 * alternative — defaulting unmapped keys to the most sensitive class — is
 * untouched: nothing here makes any key readable by default.
 * ⚠️ IF YOU ARE ABOUT TO GRANT THIS MODULE A G106 EXEMPTION, YOU HAVE
 * MISREAD IT. The fail-closed default is `field_not_classified`
 * (`model/reconciliation.ts:847`), refused at four call sites (`:1015`, `:1030`,
 * `:1044`, `:1062`), and nothing here weakens it.
 *
 * 🛑 ONE REQUEST CARRIES EXACTLY ONE UNTRUSTED HEADER. G120's answer to F1,
 * one layer earlier. Batching N headers into one context puts header #1 in a
 * position to instruct the verdict for column #7, and an index-only output
 * contract does NOT close that: the containment argument is about the ALPHABET
 * of the output, and the attack does not need a new symbol, it needs
 * `candidateIndex: 3` on a column that should have been `no_field`. There is no
 * plural arm, and `_MapperRequestCarriesExactlyOneHeader` makes adding one a
 * compile error rather than a review comment.
 *
 * 🛑 NO PATTERN IS EVER COMPILED, AND THE MAPPER MAY NOT PROPOSE AN
 * `IdentifierNormalisation`. R3, on G124/G130's reasoning verbatim: "a finance
 * operator cannot audit `^STRIPE\s(?:UK|US|EU)\sPAYOUT.*` and CAN audit 'starts
 * with STRIPE, then one of these three tokens' — and an approval nobody can read
 * is not an approval." STRICTER THAN THE LAYER IT WAS WRITTEN FOR, and the
 * reason is the reconciliation module's own honest disclaimer
 * (`model/reconciliation.ts:316-325`): `applyExtraction()` IS a small
 * interpreter, and `strip_literal.literal` and `split_take.separator` are data.
 * So the ops are authored BY THE FDE AT PROMOTION. This module does not import
 * `IdentifierNormalisation` or `ExtractionOp`, which is why it cannot name one.
 *
 * WHAT COSTS SOMETHING AND IS INHERITED RATHER THAN DROPPED — G124's cost
 * clause: "the vocabulary must grow to express what regex expresses, and some
 * patterns will be inexpressible. Those stay manual, and that is the correct
 * failure." Here "manual" means the FDE authors the mapping — which under R2 is
 * where it belonged anyway, so the cost is smaller than it was for learned
 * rules. Concretely inexpressible in v1: named-month date formats, headerless
 * files, and `col1..col9` files (O-4 refuses value samples).
 *
 * THIS MODULE HAS NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO NETWORK — the
 * engine's posture, for the engine's reason. It mints no id, reads no clock,
 * calls no model, writes no record, and emits FACTS rather than records: a
 * `SchemaMappingProposal` needs an id, a proposer and an instant, and the
 * caller assembles them with the authorisation it must already hold
 * (invariant 10; `authorize()` at `model/access.ts:1610` is the only minter).
 * That is the same split `MeterFact` makes against `UsageRecord`
 * (`model/reconciliation.ts:2513-2520`).
 *
 * EVERY FAILURE IS A VALUE. No throw. A gate returns a reasoned union, never a
 * boolean — §5.2, the reason `mayAdmit()` stopped returning a free-text reason
 * and the reason `resolveManagedService()` (`model/policy.ts:1781`) has arms.
 *
 * ⚠️ WHAT THIS MODULE'S PROOFS DO NOT COVER, STATED BECAUSE IT IS THE LIMIT.
 * The containment proofs bound what the UNTRUSTED side can put in a prompt. They
 * say NOTHING about a poisoned PACK: `MapperCandidateField.label` and
 * `.fieldPath` come from `DocumentType.fields`, which arrives in a pack, and
 * G110 puts the pack-publication validators at a seam that DOES NOT EXIST. A
 * poisoned candidate set satisfies every proof here perfectly while pointing at
 * the wrong fields. The containment is only as good as the pack seam.
 *
 * ⚠️ AND THE PROOFS CANNOT REACH ANY FIELD TYPED `FieldPath`, because
 * `export type FieldPath = string` (`model/kernel.ts:423`) is a NAKED ALIAS —
 * the same defect class `CarriedTurn` records for `Timestamp`
 * (`model/domain.ts:4303-4316`). `AssertNoTextDeep` cannot distinguish a JSONB
 * path from a pasted paragraph. Every exemption below is therefore NAMED in an
 * `Omit<>` rather than assumed, and the fix — branding `FieldPath` — is G106's
 * unapplied JSONB half and is owed as its own commit (40 sites:
 * `grep -rn 'FieldPath' model/*.ts | wc -l`).
 *
 * STANDING CONTROLS. ⚠️ STRIP COMMENTS FIRST — this header quotes several of the
 * things it bans, and a control that FAILS WHILE THE PROPERTY HOLDS teaches
 * people to ignore controls (§5.6 from the other side; the reconciliation header
 * had six of nine fail this way on its first run). Define `code` once:
 *
 *   code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/ingestion.ts; }
 *
 *   code | grep -c 'new RegExp'                       → 0   R3, G124, G130
 *   code | grep -c 'IdentifierNormalisation\|ExtractionOp'
 *                                                     → 0   R3's stricter half
 *   code | grep -c 'throw '                           → 0   failures are values
 *   code | grep -c 'Math\.random'                     → 0   the sample is derived
 *   code | grep -c 'new Date\|Date\.now'              → 0   no clock
 *   code | grep -c 'console\.'                        → 0
 *   code | grep -c ': any'                            → 0
 *   code | grep -c 'anthropic\.\|claude-\|amazon\.'   → 0   G104
 *   code | grep -ci 'price\|rateCard\|unitPrice\|\.cost'
 *                                                     → 0   invariant 5
 *   code | grep -cE '^import \{'                      → 1   the ONE value import
 *   code | grep -cE '^  readonly [a-zA-Z]+: string$'  → 2   AND WHICH TWO:
 *        `UntrustedHeader.text`      counterparty-controlled, length-capped
 *        `MapperCandidateField.label` ours, pack-authored
 *   ⚠️ THAT LAST CONTROL IS BLIND TO `FieldPath` AND `Timestamp`, both naked
 *   aliases for `string`. Two further text sites exist and are named here
 *   because no grep can find them: `MapperCandidateField.fieldPath` and
 *   `SchemaMappingEntry.target` (both `FieldPath`), plus
 *   `SchemaMappingProposal.proposedAt` (`Timestamp`).
 *
 * DECISIONS THIS MODULE IMPLEMENTS AND MAY NOT RELITIGATE
 *   G104  no model identifier as a literal — the catalogue is the only source
 *   G106  a key with no `FieldSpec` is UNREADABLE; R1 is what a HEADER is
 *   G107  this is data-plane code
 *   G110  the pack seam is the upstream dependency of every proof here
 *   G118  a typed seam with no executor must say so
 *   G120  one untrusted item per request; batch the transport, not the context
 *   G124  no generated pattern is ever compiled
 *   G125  enumerated, never widened
 *   G130  no `matches_pattern` arm reappears one layer earlier
 *   G131  every proposed entry carries the row its evidence was observed on
 * ==================================================================== */

/* Names with a re-export history come from `./domain`, per the standing rule
 * `model/examples.ts` states for its own kernel import: "a name with no
 * re-export history here has none to preserve." `DocumentTypeId`, `FieldPath`,
 * `SourceDocumentId`, `TenantScoped` and `Timestamp` are all in domain.ts's
 * re-export block (`model/domain.ts:81-128`), so they come from there. */
import type {
  DataClass,
  DataType,
  DocumentTypeId,
  ExtractedScalar,
  FieldPath,
  FieldSpec,
  ProposalActor,
  SourceDocumentId,
  TenantScoped,
  Timestamp,
} from './domain'
/* No re-export history: these two are minted by this commit. */
import type { ObservedSchemaId, SchemaMappingProposalId } from './kernel'
import type {
  AssertNoTextDeep,
  ItemRef,
  MeterFact,
  ReaderRefusal,
  ReaderTokenUsage,
} from './reconciliation'
/* The ONLY value import, and the ONLY reason for one: `tokenMeterFacts` is the
 * single producer of `input_tokens` / `output_tokens` facts in this repository
 * (`model/reconciliation.ts:2558`). A second producer would be §5.3 on the one
 * type whose whole job is to carry the provider's own numbers. `.ts` extension
 * per `CLAUDE.md`; `tests/model/runtime-importability.test.ts` is what catches
 * its absence. */
import { tokenMeterFacts } from './reconciliation.ts'

type Assert<T extends true> = T
```

⚠️ `ObservedSchemaId` and `SchemaMappingProposalId` do not exist. §2.13 gives their
declarations and the two identity-proof entries they require.

### 2.2 Branded values — `ContentDigest`, `HeaderSetHash`

Insertion point: `model/ingestion.ts`, §1, immediately after `Assert`.

```ts
/**
 * Module-private brands for the two things here that are VALUES and not rows.
 *
 * `declare const … : unique symbol` is unique PER DECLARATION, which is why
 * `model/kernel.ts:17` warns against a SECOND `Id` symbol. These are not ones:
 * they are separate brand families for separate kinds of thing, and the
 * precedent is `NormalisedDescriptionValue` (`model/learning.ts:473`), corrected
 * on 9 Aug 2026 from `Id<'NormalisedDescription'>` precisely because a derived
 * string that no table holds must not be typed as a row id.
 *
 * A digest is recomputable from its input and has no timestamp, so G35's "a
 * machine-produced TIMED record gets its own identity" does not reach it.
 * The brand symbols are module-private, so the only way to obtain one is a
 * deliberate cast at a seam — and the seam is where a reviewer looks.
 *
 * ⚠️ NEITHER IS COMPUTED HERE. `model/` has no dependency and must not acquire
 * `node:crypto`; the caller hashes the bytes and brands the result. What this
 * module does with a digest is READ IT AS A SEED (§6), which is why
 * `digest_not_hexadecimal` is a refusal arm rather than an assumption.
 */
declare const contentDigest: unique symbol
export type ContentDigest = string & { readonly [contentDigest]: 'ContentDigest' }

declare const headerSetHash: unique symbol
export type HeaderSetHash = string & { readonly [headerSetHash]: 'HeaderSetHash' }
```

Both pass `AssertNoTextDeep` for the reason recorded at `model/reconciliation.ts:240-243`:
the `T extends string ? T` arm catches a branded string before the object arm recurses.

### 2.3 `IngestBound` — required, no defaults, refusing on absence (C4's record, mapper fields)

⚠️ **ONE bound record for the whole module.** C4 lands the eight file-grain fields in build
order 4; the four below are the mapper's and join the **same** interface. If phase 4 declares
`IngestBound` anywhere other than `model/ingestion.ts`, that is the §5.3 instance to catch in
review, not this.

```ts
/**
 * Every bound ingestion needs, in one required record with NO DEFAULTS.
 *
 * ⚠️ THE NUMBERS ARE NOT MINE AND ARE NOT DEFAULTED. `PRODUCT.md` forbids
 * inventing a figure, and `IdentifierNormalisation.maxInputChars`
 * (`model/reconciliation.ts:379-387`) states the polarity for the whole
 * repository: "a bound with no number is not a bound (§5.6) … It is never
 * silently unbounded, which is the outcome a default would produce." They are
 * FDE-set configuration in a pack template — the `FieldSpec.confidenceFloor`
 * posture (G22/G38, `model/domain.ts:1732-1759`) — and an unset bound REFUSES.
 * Owner ruling O-8.
 */
export interface IngestBound {
  /* --- C4, build order 4. Declared here so there is one record, not two. --- */
  readonly maxObjectBytes: number
  readonly maxDecompressedBytes: number
  readonly maxCompressionRatio: number
  readonly maxPages: number
  readonly maxRows: number
  readonly maxCellChars: number
  readonly maxArchiveDepth: number
  readonly maxRowsPerTransaction: number
  /* --- C9/C10/C12, build order 5 --- */
  /** Columns beyond this REFUSE the probe. A 4,000-column sheet is an attack. */
  readonly maxObservedColumns: number
  /** Candidate fields offered per request. The `readerCandidateCap` posture. */
  readonly maxCandidateFields: number
  /** Run-length pairs kept per skeleton. Caps the profile, not the file. */
  readonly maxSkeletonRuns: number
  /** Distinct skeletons kept per column, most frequent first. */
  readonly maxDistinctSkeletons: number
  /**
   * 🟢 THE k-ANONYMITY FLOOR, AND IT IS MINE — no team proposed it.
   *
   * A shape projection of a LOW-CARDINALITY column IS the value. A `Y`/`N` flag
   * has a one-character skeleton that is the datum; a two-valued status column
   * is the same. R1 rules SHAPE readable on the argument that a shape is not a
   * value — that argument is sound for a 16-digit account number and FALSE for a
   * boolean. Below this floor the profile carries
   * `{ kind: 'suppressed_low_cardinality' }` and the mapper sees the key, the
   * ordinal and nothing else.
   * The precedent for the mechanism, reused not invented: `AGGREGATE_COHORT_FLOOR`
   * and `aggregateIsDisclosable()` (`model/billing.ts`, cited at
   * `model/learning.ts:1725-1727` as "A COHORT FLOOR, REUSED NOT REINVENTED").
   * ⚠️ THE NUMBER IS THE OWNER'S. There is no default.
   */
  readonly minDistinctValuesToProfile: number
}

export type BoundDefect = { readonly kind: 'bound_not_stated'; readonly field: keyof IngestBound }

/**
 * Total. Refuses a non-integer or non-positive value on every field it reads —
 * so the choice is STATED or the probe refuses. `maxCompressionRatio` is
 * permitted to be non-integer and is still required to be finite and > 1.
 */
export function validateIngestBound(bound: IngestBound): readonly BoundDefect[]
```

⚠️ `BoundDefect.field` is `keyof IngestBound`, a closed literal union — it passes
`AssertNoTextDeep`, and `_BoundDefectHoldsNoText = AssertNoTextDeep<BoundDefect>` is worth
declaring for exactly the reason the reader's refusals are: someone will want
`message: string` on it.

### 2.4 `SampleSelection` — deterministic SPREAD sampling from the digest (C12)

Insertion point: §2 of the module, before the profile, because the profile is derived from a
selection.

```ts
export interface SampleDemand {
  /** Data rows, EXCLUDING the header row and excluding any trailer (C18). */
  readonly rowCount: number
  readonly sampleSize: number
  readonly heldOutSize: number
  readonly digest: ContentDigest
}

/**
 * WHICH ROWS WERE PROFILED, AND WHICH WERE HELD BACK. Reproducible for audit.
 *
 * ⚠️ "THE FIRST 5 ROWS" IS REFUSED (A8), AND THE REASON IS NOT ONLY BIAS.
 * A head sample of a file sorted by anything is systematically unrepresentative
 * — but the decisive fault is that it is NOT REPRODUCIBLE FOR AUDIT once a file
 * is re-delivered under a different arrival order. Seeding from the content hash
 * makes "which rows did the FDE see" answerable from the row.
 *
 * ⚠️ SPREAD IS NOT REPRESENTATIVE AND I AM NOT CLAIMING IT IS. The honest claim
 * is: the sample is distributed across the file's index range at a stride, from a
 * digest-derived offset, and it is not a head sample. Representativeness would
 * require reading VALUES to stratify on, which R1 forbids.
 *
 * ⚠️ AND A PROPERTY NOBODY STATED, RECORDED RATHER THAN ASSERTED AWAY: seeding
 * from `sha256(bytes)` makes the selection ADVERSARIALLY PREDICTABLE. A sender
 * who chooses the bytes can grind the digest and choose which rows are profiled
 * — and, worse, which rows land in the HELD-OUT set that C13's conformance floor
 * is computed over. The mitigation for the first half is that the mapper sees no
 * values at all (R1/O-4), so choosing the profiled rows shifts only the SHAPE
 * the model is shown. The second half is a real gap: RECOMMENDED, and it is a
 * change to C13 rather than to this type — re-draw the held-out set at PROMOTION
 * time with the promoted mapping's id mixed into the seed, because that id does
 * not exist when the file is authored and therefore cannot be ground against.
 */
export interface SampleSelection {
  readonly rowCount: number
  readonly digest: ContentDigest
  readonly stride: number
  readonly offset: number
  /** Strictly increasing, in range, length === sampleSize. */
  readonly sampleIndices: readonly number[]
  /** Strictly increasing, in range, DISJOINT from `sampleIndices`. */
  readonly heldOutIndices: readonly number[]
}

export type _SampleSelectionHoldsNoTextDeep = AssertNoTextDeep<SampleSelection>

export type SampleRefusal =
  | { kind: 'row_count_not_stated' }
  | { kind: 'sample_size_not_stated' }
  | { kind: 'held_out_size_not_stated' }
  /** The file has fewer rows than the sample plus the held-out set demands. */
  | { kind: 'row_count_below_sample_demand'; demanded: number }
  /** The digest is not usable as a seed. Refused, never defaulted to zero. */
  | { kind: 'digest_not_hexadecimal' }

export type _SampleRefusalHoldsNoText = AssertNoTextDeep<SampleRefusal>

export type SampleResult =
  | { ok: true; selection: SampleSelection }
  | { ok: false; refusal: SampleRefusal }

/**
 * Total, pure, deterministic. Never throws; never calls `Math.random`.
 *
 * THE FIVE PROPERTIES THE TESTS PIN, AND THE INTERLEAVE IS NOT ONE OF THEM:
 *   1. `sampleIndices.length === sampleSize` and
 *      `heldOutIndices.length === heldOutSize`, exactly.
 *   2. The two are DISJOINT — by construction, not by a post-filter.
 *   3. Every index is in `[0, rowCount)`.
 *   4. Both are strictly increasing.
 *   5. Identical `(digest, rowCount, sampleSize, heldOutSize)` gives an
 *      identical selection, and a one-character digest change moves the offset.
 * Any interleave satisfying those five is substitutable. The one below walks the
 * `demand` stride positions and assigns each to the sample or the held-out set by
 * an integer ratio test, which needs no division and no floating point.
 */
export function selectSample(demand: SampleDemand): SampleResult {
  const { rowCount, sampleSize, heldOutSize, digest } = demand
  if (!Number.isInteger(rowCount) || rowCount < 1) {
    return { ok: false, refusal: { kind: 'row_count_not_stated' } }
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 1) {
    return { ok: false, refusal: { kind: 'sample_size_not_stated' } }
  }
  if (!Number.isInteger(heldOutSize) || heldOutSize < 1) {
    return { ok: false, refusal: { kind: 'held_out_size_not_stated' } }
  }
  const demanded = sampleSize + heldOutSize
  if (rowCount < demanded) {
    return { ok: false, refusal: { kind: 'row_count_below_sample_demand', demanded } }
  }
  const seed = seedFromDigest(digest)
  if (seed === null) {
    return { ok: false, refusal: { kind: 'digest_not_hexadecimal' } }
  }
  const stride = Math.floor(rowCount / demanded)
  const offset = seed % stride
  const sampleIndices: number[] = []
  const heldOutIndices: number[] = []
  for (let j = 0; j < demanded; j += 1) {
    const position = offset + j * stride
    if ((sampleIndices.length + 1) * demanded <= (j + 1) * sampleSize) {
      sampleIndices.push(position)
    } else {
      heldOutIndices.push(position)
    }
  }
  return {
    ok: true,
    selection: { rowCount, digest, stride, offset, sampleIndices, heldOutIndices },
  }
}

/**
 * The seed, from OUR OWN hash of the bytes. Total; returns null rather than
 * throwing or defaulting.
 *
 * ⚠️ A DIGEST IS DERIVED FROM COUNTERPARTY BYTES AND CARRIES NONE OF THEM, which
 * is why reading it is not a G106 or invariant-6 question. It is machine-produced
 * transport metadata in the sense `ReaderTokenUsage.providerRequestId` is
 * (`model/reconciliation.ts:2286-2290`).
 * A non-hex digest REFUSES rather than contributing 0, because a silent 0 makes
 * every file's offset identical and turns a spread sample back into a head
 * sample — a control that passes while asserting nothing (§5.6).
 */
function seedFromDigest(digest: ContentDigest): number | null
```

*Worked check of the ratio test, since a wrong split is silent:* `demanded = 5`,
`sampleSize = 2` → j=0 `1*5 ≤ 1*2`? no → held; j=1 `5 ≤ 4`? no → held; j=2 `5 ≤ 6`? yes →
sample; j=3 `10 ≤ 8`? no → held; j=4 `10 ≤ 10`? yes → sample. Sample 2, held-out 3. ✓
Highest position `offset + (demanded-1)*stride ≤ (stride-1) + (demanded-1)*stride =
demanded*stride - 1 ≤ rowCount - 1`. ✓ In range without a clamp.

### 2.5 The character-class skeleton — bounded enum INDICES, never a string

```ts
/**
 * THE CHARACTER CLASSES, AS INDICES. §3 of this module.
 *
 * 🛑 WHY INDICES AND NOT NAMES, AND THIS IS THE LOAD-BEARING DECISION IN THE
 * WHOLE PROFILE. A closed union of class NAMES — `'digit' | 'letter' | …` —
 * would pass `AssertNoTextDeep` perfectly well, because `string extends 'digit'`
 * is false. So would a union of the OBSERVED CHARACTERS themselves:
 * `'A' | 'B' | '7' | …` is also a closed literal union and ALSO PASSES. The
 * tempting edit is exactly that one — "the skeleton is easier to debug if we keep
 * the letters" — and it would defeat the entire proof WHILE THE PROOF STAYED
 * GREEN. That is §5.6 inside the control written to prevent it.
 * A numeric index cannot hold a character. The index→label table is a value on
 * the privileged side and NEVER appears on a `MapperRequest`.
 *
 * ⚠️ WHAT A SKELETON STILL LEAKS, STATED: length, and the run structure. A
 * 16-digit account number becomes "16 digits" — no character of it crosses, and
 * its SHAPE does. R1 rules the shape readable. `IngestBound
 * .minDistinctValuesToProfile` is what stops that ruling being applied to a
 * column where the shape IS the value.
 *
 * `erasableSyntaxOnly` forbids an enum; this is the const-object-plus-union form
 * `CLAUDE.md` requires and `EXTRACTION_OP_KINDS` (`model/reconciliation.ts:339`)
 * models.
 */
export const CHARACTER_CLASS_INDEX = {
  digit: 0,
  upperLetter: 1,
  lowerLetter: 2,
  space: 3,
  punctuation: 4,
  signMark: 5,
  currencyMark: 6,
  other: 7,
} as const

export type CharacterClass =
  (typeof CHARACTER_CLASS_INDEX)[keyof typeof CHARACTER_CLASS_INDEX]

/**
 * FOR THE FDE'S SCREEN, ON THE PRIVILEGED SIDE ONLY.
 *
 * A total `Record` so a ninth class is a compile error here rather than an
 * `undefined` on a screen (`noUncheckedIndexedAccess`). ⚠️ §5.10: a total record
 * with no construction site witnesses nothing — this DECLARATION is its
 * construction site, which is why it is a `const` and not a type.
 * It is never referenced by any type in §8 and must never be.
 */
export const CHARACTER_CLASS_LABEL: Record<CharacterClass, string> = {
  0: 'digit',
  1: 'upper letter',
  2: 'lower letter',
  3: 'space',
  4: 'punctuation',
  5: 'sign',
  6: 'currency mark',
  7: 'other',
}

/** One run of one class. `length` is a COUNT, never a substring. */
export interface SkeletonRun {
  readonly classIndex: CharacterClass
  readonly length: number
}

/**
 * A shape seen in the sample, how often, and ONE row that exhibited it.
 *
 * `witness` is REQUIRED-AND-NULLABLE, never optional, and the polarity is
 * `ObservedScopeValue.observedOn`'s (`model/learning.ts:487-495`) for its reason:
 * optional lets a payload omit the key silently, and non-nullable would put the
 * whole control in a compiler that does not run on the wire. G131's provenance,
 * at the grain an aggregate actually has.
 */
export interface ProfileSkeleton {
  readonly runs: readonly SkeletonRun[]
  readonly occurrences: number
  readonly witness: ItemRef | null
}
```

### 2.6 `ColumnProfile`, `ObservedKey`, `UntrustedHeader`, `ObservedSchema` (C9)

```ts
/**
 * WHETHER A SHAPE WAS DISCLOSED AT ALL. A union, not a nullable array — an empty
 * array would read as "profiled, nothing found", and "suppressed" and "found
 * nothing" are different facts. §8.6's null/empty inversion is this record's own
 * precedent for a null that fails open.
 */
export type ColumnShapeDisclosure =
  | { kind: 'profiled'; skeletons: readonly ProfileSkeleton[] }
  | { kind: 'suppressed_low_cardinality' }
  | { kind: 'suppressed_run_budget_exceeded' }

/**
 * WHAT A DETERMINISTIC PROBE LEARNED ABOUT ONE COLUMN WITHOUT KEEPING A VALUE.
 *
 * NO MODEL IS IN THIS PATH. Every field is computed by a total function over the
 * sampled cells, and no cell survives into the type.
 *
 * ⚠️ COUNTS, NOT FRACTIONS. C9 asked for `nonNullFraction`; two integers
 * reproduce it exactly, compare with `===` in a fixture, and cannot drift by a
 * float rounding — the discipline `Money.amountMinor` states for the same reason
 * (`model/domain.ts:534`).
 */
export interface ColumnProfile {
  readonly ordinal: number
  readonly rowsSampled: number
  readonly nonNullCount: number
  readonly distinctCount: number
  readonly minLength: number
  readonly maxLength: number
  readonly parsesAsInteger: boolean
  readonly parsesAsDecimal: boolean
  readonly parsesAsIso8601Date: boolean
  /**
   * ⚠️ AND THERE IS NO ISO 4217 TABLE IN THIS REPOSITORY TO CHECK AGAINST.
   * `model/policy.ts:806-811` records the absence and refuses to derive an
   * exponent from a currency code for exactly this reason. So this flag is
   * EVIDENCE FOR A HUMAN and is not a validation: it is true when every sampled
   * non-null cell is three A–Z characters. It must not be read as "this is a
   * currency column", and C16's "validated against a closed ISO set" has no set
   * to validate against until somebody lands one.
   */
  readonly matchesThreeLetterUpperCase: boolean
  readonly monotonic: boolean
  readonly shape: ColumnShapeDisclosure
}

/**
 * 🟢 THE CONTAINMENT PROOF THAT MATTERS MOST. If a plain `string` appears
 * anywhere inside `ColumnProfile`, at any depth, this is a compile error.
 *
 * This is the type through which a VALUE would have to travel to reach the
 * mapper. Making it text-free makes "the mapper never sees a value" a compile
 * error rather than a review convention — R1, mechanised.
 *
 * VERIFY IT RED BEFORE TRUSTING IT GREEN, the way
 * `_ReaderVerdictHoldsNoTextDeep` asks to be (`model/reconciliation.ts:2237`).
 * The tempting edits are named here rather than left to a reviewer: somebody
 * will want `mostCommonValue: string` "just for the FDE screen", and somebody
 * will want `sampleValues: readonly string[]` "to make the prompt better".
 * `ItemRef.sourceDocumentId` is a branded `Id<'SourceDocument'>` and passes, for
 * the reason recorded at `model/reconciliation.ts:240-243`.
 */
export type _ColumnProfileHoldsNoTextDeep = AssertNoTextDeep<ColumnProfile>

/** One observed column, with no header on it. */
export interface ObservedKey {
  readonly ordinal: number
  /**
   * The probe's guess, in the model's OWN vocabulary — no sixth spelling.
   * It is a HINT for the candidate narrowing, never a decision: a column that
   * parses as an integer may be a quantity, a document number or a year.
   */
  readonly inferredType: DataType
  readonly profile: ColumnProfile
}

export type _ObservedKeyHoldsNoTextDeep = AssertNoTextDeep<ObservedKey>

/**
 * THE ONE TEXT FIELD IN THIS MODULE'S UNTRUSTED HALF, ISOLATED IN A TYPE OF ITS
 * OWN SO THE EXEMPTION IS A DECLARATION AND NOT AN OVERSIGHT.
 *
 * R1: a column header is the NAME OF A SLOT, not an `ExtractedValue`. Reading the
 * header row of a CSV is not reading the field.
 *
 * ⚠️ IT IS STILL COUNTERPARTY-CONTROLLED PROSE. A header can read "ignore all
 * previous instructions". Three things bound it and none of them is trust:
 *   · it is truncated to `IngestBound.maxCellChars` and `truncated` records that
 *     it happened, so a 40kB "header" is a visible fact and not a silent one;
 *   · the OUTPUT alphabet is indices (§8), so the worst achievable outcome is a
 *     wrong index — which `applyMapperVerdicts` bounds-checks and a human then
 *     promotes or does not;
 *   · exactly one header per request, so header #1 cannot instruct column #7.
 *
 * NO `DataClass` SITS ON THIS TYPE, AND THAT IS R1 RATHER THAN AN OMISSION.
 * An unmapped key has no `FieldSpec`, therefore no `dataClass` and no
 * `modelProcessingAllowed` — computing one would be the circularity R1 dissolves,
 * and defaulting one would be G106's rejected alternative. The class operand the
 * CALLER checks its prompt ceiling against is the DOCUMENT TYPE's
 * (`MapperRequest.candidateMaxDataClass`), which is our own declaration.
 */
export interface UntrustedHeader {
  readonly ordinal: number
  readonly text: string
  readonly truncated: boolean
}

/**
 * 🟢 THE PROOF THAT THE HEADER TYPE CARRIES NOTHING BUT THE HEADER.
 *
 * `text` is exempted BY NAME. Every other field must be text-free, so
 * `firstValue: string`, `mostCommonValue: string` or `rawRow: string` — the three
 * edits that would smuggle a value in beside the name it belongs to — are
 * compile errors. This is the narrowest place the exemption can be stated, which
 * is why the header lives in its own interface rather than on `ObservedKey`.
 */
export type _UntrustedHeaderCarriesNothingButTheHeaderText =
  AssertNoTextDeep<Omit<UntrustedHeader, 'text'>>

/**
 * ONE COLUMN: the text-free observation and the header, joined.
 *
 * ⚠️ ONE ARRAY, NOT TWO PARALLEL ONES. `keys[]` beside `headers[]` is two lists
 * that can disagree about ordinal, and an index into the wrong one is A9(d)
 * reintroduced — the shape `applyReaderVerdicts` refuses at
 * `model/reconciliation.ts:2442-2446`. `validateObservedSchema()` still checks
 * ordinals are contiguous and agree, because the type cannot.
 * NOT deep-asserted, deliberately: it holds the header. See §5's negative proof.
 */
export interface ObservedColumn {
  readonly key: ObservedKey
  readonly header: UntrustedHeader
}

/**
 * WHAT THE PROBE OBSERVED ABOUT ONE ARTEFACT. An entity: it is a
 * machine-produced, TIMED record a human is shown and a proposal cites (G35).
 *
 * `sourceDocumentId` is what makes C15 expressible — the probe is an FDE act
 * against ONE NAMED document under `REQUIRES_ENUMERATION`
 * (`model/governance.ts:497`), minting an `AuthorizationGrant` (invariant 10) and
 * a `DataAccessEvent`. No new access machinery.
 *
 * `headerSetHash` is O-5's selector: a mapping is pinned to
 * `(sourceEndpointId, headerSetHash)`, because `Setup.dc.html:268` shows two
 * SharePoint folders receiving dockets from many suppliers — so a folder is not a
 * schema. ⚠️ WHAT GOES INTO THE HASH IS A DECISION AND IT IS NOT MINE: order-
 * sensitive or not, case-folded or not, whitespace-normalised or not. C13's
 * drift refusal is "exactly equal", so if the hash normalises anything the
 * refusal is weaker than it reads. Ruling needed (§7, O-9).
 */
export interface ObservedSchema extends TenantScoped {
  readonly id: ObservedSchemaId
  readonly sourceDocumentId: SourceDocumentId
  readonly documentTypeId: DocumentTypeId
  readonly digest: ContentDigest
  readonly headerSetHash: HeaderSetHash
  readonly columns: readonly ObservedColumn[]
  readonly sample: SampleSelection
  readonly observedAt: Timestamp
}

export type ObservedSchemaDefect =
  | { kind: 'no_columns' }
  | { kind: 'too_many_columns'; limit: number }
  | { kind: 'column_ordinals_not_contiguous'; at: number }
  | { kind: 'key_and_header_ordinal_disagree'; at: number }
  | { kind: 'header_not_truncated_within_cap'; at: number }
  | { kind: 'profile_row_count_disagrees_with_sample'; at: number }

export type _ObservedSchemaDefectHoldsNoText = AssertNoTextDeep<ObservedSchemaDefect>

export function validateObservedSchema(
  schema: ObservedSchema,
  bound: IngestBound,
): readonly ObservedSchemaDefect[]
```

### 2.7 The codecs (C11) — closed unions, and the `'string'`/`'text'` reconciliation

```ts
/**
 * WHAT A CODEC PRODUCES — the parse output's OWN vocabulary, not a sixth one.
 *
 * `Exclude<…, 'absent'>` because a codec that produces "absent" is not a codec,
 * it is the `{kind:'absent'}` source arm on the entry. The assertion below is the
 * §5.3 mitigation in the shape `_SetDispositionsAreDeclaredFamilies`
 * (`model/reconciliation.ts:190`) uses: a rename in `domain.ts` is a compile
 * error here rather than a silently divergent second list.
 */
export type CodecTarget = Exclude<ExtractedScalar['kind'], 'absent'>

export type _CodecTargetsAreExtractedScalarKinds = Assert<
  CodecTarget extends ExtractedScalar['kind'] ? true : false
>

/**
 * 🟢 THE ONE PLACE `DataType` AND `ExtractedScalar['kind']` ARE JOINED — and
 * they DISAGREE in the tree by one member.
 *
 * `DataType` (`model/domain.ts:645`) spells it `'string'`; `ExtractedScalar`
 * (`model/domain.ts:1821`) spells the same concept `'text'`. Verified: `DataType`
 * has exactly one reader in the whole model, `FieldSpec.dataType`
 * (`model/domain.ts:1720`), and NOTHING anywhere maps between the two —
 * `grep -rn 'DataType' model/*.ts` returns two lines, the declaration and that
 * field. So the divergence has never been crossed, and this seam is the first
 * thing that must cross it.
 *
 * A total `Record` rather than a function: an unhandled `DataType` member is then
 * a compile error, which is why `CAPABILITY_RESOURCE_CLASS` and `TOOL_EFFECT`
 * exist in this shape. ⚠️ AND UNLIKE THOSE TWO IT HAS A CONSTRUCTION SITE — this
 * declaration — so §5.10 does not apply and `tsc` is telling you something here.
 *
 * ⚠️ THE HONEST FIX IS UPSTREAM: one of the two spellings should go. That is a
 * `domain.ts` change with its own call-site audit, and this map is the stopgap
 * that names the divergence instead of hiding it — the posture
 * `model/reconciliation.ts:99-105` states for `PopulationBinding`.
 */
export const CODEC_TARGET_FOR_DATA_TYPE: Record<DataType, CodecTarget> = {
  string: 'text',
  number: 'number',
  date: 'date',
  money: 'money',
  identifier: 'identifier',
}

/* --- the conventions. NAMES OF CONVENTIONS, never the characters. --------- *
 *
 * ⚠️ WHY NAMES AND NOT THE CHARACTERS THEMSELVES: `'.' | ','` is also a closed
 * literal union and would also pass the deep proof, so the proof would not stop
 * a "helpful" widening to the observed character. The character each name
 * resolves to is a total `Record` on the DECODER's side (§7 of the parse work),
 * so no character ever crosses the seam in either direction.
 * A convention outside these lists is a PLATFORM RELEASE, exactly like a
 * `PairingStrategy` kind: packs parameterise, never extend. */
export type DecimalSeparator = 'dot' | 'comma'
export type GroupSeparator = 'none' | 'comma' | 'dot' | 'space' | 'apostrophe'
export type SignConvention =
  | 'leading_minus'
  | 'trailing_minus'
  | 'parenthesised_negative'
  | 'unsigned'
export type CurrencyMarkPlacement = 'absent' | 'leading' | 'trailing'

export type DateFieldOrder = 'ymd' | 'dmy' | 'mdy'
export type DateSeparator = 'dash' | 'slash' | 'dot' | 'none'
export type YearWidth = 'four' | 'two'

/**
 * A DATE FORMAT AS THREE ENUMERATED DIMENSIONS. Never a format string.
 *
 * `dmy` versus `mdy` is the load-bearing ambiguity — 03/04/2026 is two different
 * days — and it is exactly what a human can audit and a pattern cannot.
 *
 * ⚠️ NO `monthForm`, AND THAT IS G124'S COST CLAUSE PAID RATHER THAN DODGED.
 * Named months ("03 Apr 26") need a locale table that does not exist in this
 * repository, and adding a member with no decoder would be §5.6 — a control that
 * passes while asserting nothing. Named-month files are INEXPRESSIBLE in v1 and
 * stay manual. "Those stay manual, and that is the correct failure."
 */
export interface DateFormat {
  readonly order: DateFieldOrder
  readonly separator: DateSeparator
  readonly yearWidth: YearWidth
}

export interface DecimalConvention {
  readonly decimalSeparator: DecimalSeparator
  readonly groupSeparator: GroupSeparator
  readonly sign: SignConvention
  readonly currencyMark: CurrencyMarkPlacement
}

/**
 * HOW A LEXEME BECOMES AN `ExtractedScalar`. Closed, enumerated, chosen BY INDEX.
 *
 * 🛑 THE `money` ARM CARRIES NO CURRENCY CODE, AND THAT IS C16 IN THE TYPE.
 * Currency is DECLARED, never inferred: today `expectedCurrency` seeds from
 * whichever row is admitted first (`model/reconciliation.ts` §4), so a model that
 * could name a currency could denominate an entire population from one cell with
 * nothing refusing. No arm here can produce one. The exponent is likewise absent
 * — `model/policy.ts:806-811` refuses to derive an exponent from a currency code
 * because there is no ISO 4217 table here to derive it from.
 *
 * 🛑 AND NO ARM CARRIES AN OP LIST. R3: the mapper may not propose an
 * `IdentifierNormalisation`, because `applyExtraction()` is a small interpreter
 * and `strip_literal.literal` / `split_take.separator` are data
 * (`model/reconciliation.ts:316-325`). The `identifier` arm selects the column
 * and nothing else; the FDE authors the ops at promotion, against the existing
 * `validateNormalisation()` (`model/reconciliation.ts:412`).
 */
export type ValueCodec =
  | { kind: 'text' }
  | { kind: 'number'; convention: DecimalConvention }
  | { kind: 'money'; convention: DecimalConvention }
  | { kind: 'date'; format: DateFormat }
  | { kind: 'identifier' }

export type _ValueCodecKindsAreCodecTargets = Assert<
  ValueCodec['kind'] extends CodecTarget ? true : false
>

export type _ValueCodecHoldsNoTextDeep = AssertNoTextDeep<ValueCodec>

/**
 * 🟢 R3'S STRICTER HALF, BY NAME AND NOT ONLY BY THE TEXT PROOF.
 *
 * The deep proof already forbids MOST of an op list — `strip_literal` and
 * `split_take` carry strings, so `ops` on a verdict would fail
 * `_MapperVerdictHoldsNoTextDeep`. It is NOT sufficient: `{kind:'trim'}` and
 * `{kind:'strip_leading_zeros'}` carry no string and would pass. This assertion
 * is what makes the ruling total, and the module's non-import of `ExtractionOp`
 * is what makes it hard to violate by accident.
 */
export type _NoCodecArmCarriesOps = Assert<
  Extract<ValueCodec, { ops: unknown }> extends never ? true : false
>
```

### 2.8 The seam (C10) — `MapperRequest`, and the proof on the way IN

```ts
/**
 * ONE CANDIDATE FIELD THE PRIVILEGED SIDE OFFERS. The model may name it only by
 * index. `ReaderCandidate`'s shape (`model/reconciliation.ts:2188`) and its rule.
 *
 * Built BY US from `DocumentType.fields` (`model/domain.ts:1800`). `label` is
 * pack-authored prose and is what makes the reading possible at all — the same
 * standing `identifierForPrompt` occupies. `fieldPath` is `FieldPath`, a naked
 * alias for `string` (`model/kernel.ts:423`), so no proof here can see it: it is
 * named in the header's text-site list instead.
 *
 * ⚠️ `modelProcessingAllowed` IS DELIBERATELY NOT HERE. That flag governs whether
 * a field's VALUES may reach a provider, and no value reaches one from this seam.
 * Offering a candidate is offering a slot NAME. The flag governs the parse path
 * that later fills it, and duplicating it here would invite the reading that this
 * seam is where invariant 4 is enforced. It is not; `FieldSpec` is.
 */
export interface MapperCandidateField {
  readonly index: number
  readonly fieldPath: FieldPath
  readonly label: string
  readonly dataType: DataType
  readonly required: boolean
}

/** One codec the privileged side offers for this column, named only by index. */
export interface MapperCodecCandidate {
  readonly index: number
  readonly codec: ValueCodec
}

/**
 * ONE COLUMN, ONE REQUEST. THERE IS NO PLURAL ARM AND THERE MUST NEVER BE ONE.
 *
 * G120's answer to red-team F1, one layer earlier than G120 took it: "N parallel
 * single-record invocations … the TYPE enforces at compile time what the state
 * machine enforces at runtime — two independent mechanisms holding one property."
 * A fan-out that is correct today is a fan-out somebody batches next quarter to
 * save tokens; a type with no plural arm is not available to be chosen in a hurry.
 *
 * `candidateMaxDataClass` IS THE OPERAND, NOT THE CHECK. This module never
 * compares two `DataClass` values, because `model/policy.ts:1693-1706` records
 * that four copies of that ordering already exist and that unifying them is owed
 * as its own commit. The caller checks it against `maxDataClassInPrompt` —
 * exactly as `ReaderRequest.untrustedDescriptionClass` is checked by the caller
 * (`model/reconciliation.ts:2199`). ⚠️ WHICH CEILING GOVERNS, and whether a
 * document-level class can be computed at all, are OWNER RULINGS O-2 and O-3.
 * This type carries the operand so that either answer is expressible without a
 * change to the seam.
 */
export interface MapperRequest {
  readonly requestOrdinal: number
  readonly observedSchemaId: ObservedSchemaId
  readonly documentTypeId: DocumentTypeId
  readonly headerSetHash: HeaderSetHash
  /** ⚠️ COUNTERPARTY-CONTROLLED. EXACTLY ONE COLUMN'S. Data, never instruction. */
  readonly untrustedHeader: UntrustedHeader
  readonly profile: ColumnProfile
  readonly candidates: readonly MapperCandidateField[]
  readonly codecs: readonly MapperCodecCandidate[]
  /** The maximum `dataClass` declared across the document type's own fields. */
  readonly candidateMaxDataClass: DataClass
}

/**
 * 🟢 THE CONTAINMENT PROOF ON THE REQUEST PATH. NOTHING IN THIS TREE HAD ONE.
 *
 * Derived, this session: `AssertNoTextDeep` is applied at thirteen sites, ALL in
 * `model/reconciliation.ts`, and every one is a return-path union. The only
 * request-path proof anywhere is the SHALLOW `AssertNoPlainText<CarriedTurn>`
 * (`model/identity.ts:1189`), and shallow does not recurse — a nested
 * `{ v: string }` passes it (`model/reconciliation.ts:234-238`).
 *
 * TWO FIELDS ARE EXEMPTED AND BOTH ARE NAMED IN THE `Omit`, WHICH IS THE POINT:
 *   · `untrustedHeader` — the slot NAME, R1, with its own narrower proof above.
 *   · `candidates` — OUR pack-authored labels and paths.
 * Everything else — the profile, the codecs, the ids, the class — must be
 * text-free. So `filename: string`, `rawHeaderRow: string`, `promptPreamble:
 * string` and a `sampleValues` array are all compile errors, and the exemption
 * cannot GROW without editing this line, which is a diff somebody must justify.
 *
 * ⚠️ THIS PROOF SAYS NOTHING ABOUT A POISONED PACK. See the module header.
 */
export type _MapperRequestQuarantinedHalfHoldsNoTextDeep =
  AssertNoTextDeep<Omit<MapperRequest, 'untrustedHeader' | 'candidates'>>

/**
 * 🟢 THE NO-PLURAL-ARM PROOF. G120's property, asserted rather than commented.
 *
 * The reader seam states this in prose — "The type below carries exactly one
 * description and there is no plural arm" (`model/reconciliation.ts:2174-2176`)
 * — and nothing checks it. Here, widening `untrustedHeader` to
 * `readonly UntrustedHeader[]` makes this `Assert<false>` and `tsc` reports
 * TS2344. ⚠️ THE READER SEAM SHOULD INHERIT THIS LINE; that is a change to
 * applied code with its own red run and is not smuggled into this commit.
 */
export type _MapperRequestCarriesExactlyOneHeader = Assert<
  MapperRequest['untrustedHeader'] extends readonly unknown[] ? false : true
>
```

### 2.9 The verdict, the refusal, the outcome

```ts
/**
 * WHAT MAY CROSS BACK. AN INDEX, NEVER A NAME.
 *
 * FOUR ARMS, and the fourth pair is one fact with one spelling: `several` is
 * "more than one candidate fits" — `AMBIGUOUS` and `MULTIPLE_MATCHES` would be
 * §5.3 in miniature on the one type whose whole job is to be closed
 * (`model/reconciliation.ts:2213-2217`).
 *
 * 🛑 `field` CARRIES TWO INDICES AND NOTHING ELSE. No key name, no path, no
 * format string, no pattern, no op list. The privileged side supplies the
 * vocabulary — both vocabularies — and the quarantined side chooses from them
 * (G120's containment, `model/reconciliation.ts:2210-2211`).
 *
 * 🛑 `several` CARRIES NO CODEC, deliberately. An ambiguous column is a finding
 * for a human, not a half-decision to be completed by a default.
 *
 * `confidenceBasisPoints` is KEPT and NON-LOAD-BEARING by the standing ruling
 * (`model/reconciliation.ts:2219-2225`): it is a model's self-report about
 * attacker-influenced input, so it is itself attacker-influenceable. It may ORDER
 * A QUEUE for the FDE; it may never GATE A PROMOTION. ⚠️ Nothing enforces that,
 * which is §5.1's shape, recorded once as a deliberate choice — the same way the
 * reader records it.
 */
export type MapperVerdict =
  | { kind: 'field'; candidateIndex: number; codecIndex: number; confidenceBasisPoints: number }
  | { kind: 'several'; candidateIndices: readonly number[]; confidenceBasisPoints: number }
  | { kind: 'no_field'; confidenceBasisPoints: number }
  | { kind: 'unreadable'; confidenceBasisPoints: number }

/**
 * 🟢 THE RETURN-PATH PROOF. If a `string` ever appears anywhere inside
 * `MapperVerdict`, at any depth, this is a compile error.
 *
 * VERIFY IT RED BEFORE TRUSTING IT GREEN — add `columnName: string` to the
 * `field` arm and `tsc` reports TS2344 (§5, R5). The tempting edits are exactly
 * three and are named here rather than left to a reviewer: the header text back
 * "for a nicer review screen", the field PATH back "so we can skip the index
 * lookup", and a `notes` field "so the model can explain itself". The third is
 * the dangerous one: a rationale is free-form counterparty-influenced prose that
 * would land on the row a finance user reads and a screen renders.
 */
export type _MapperVerdictHoldsNoTextDeep = AssertNoTextDeep<MapperVerdict>

/**
 * SEVEN ARMS SHARED WITH THE READER, FOUR THAT ARE THIS SEAM'S OWN.
 *
 * ⚠️ A SECOND SPELLING OF ONE VALUE SET IS §5.3 AND THIS IS HOW IT IS AVOIDED
 * WITHOUT TOUCHING APPLIED CODE. `ReaderRefusal` (`model/reconciliation.ts:2269`)
 * is live, referenced by `ResidueCause` and by tests; refactoring it into a
 * shared base is a change to applied code and is not smuggled in here. Instead
 * the shared kinds are restated and PINNED IN BOTH DIRECTIONS below — the
 * mitigation `_SetDispositionsAreDeclaredFamilies` (`:190`) applies to the one
 * place a shared declaration was not available.
 */
export type MapperRefusal =
  /* --- shared with the reader, spelling pinned by assertion --- */
  | { kind: 'not_implemented' }
  | { kind: 'contract_violation' }
  | { kind: 'response_truncated' }
  | { kind: 'response_exceeded_byte_cap' }
  | { kind: 'transport_failed' }
  | { kind: 'candidate_index_out_of_range' }
  | { kind: 'model_rejected_by_policy' }
  /* --- this seam's own --- */
  /** The verdict named a codec outside the set offered. Containment held. */
  | { kind: 'codec_index_out_of_range' }
  /** The chosen codec cannot produce the chosen field's `dataType`. */
  | { kind: 'codec_target_disagrees_with_field' }
  /**
   * O-3, FAIL-CLOSED. A `DocumentType` declaring no fields has no candidate set
   * and no computable class ceiling, so no request is built for it. Matching
   * `DENY_ALL` and G100's deny-on-NULL.
   */
  | { kind: 'document_type_declares_no_fields' }
  /** The column's shape was suppressed, so there is nothing to reason over. */
  | { kind: 'column_shape_suppressed' }

export type _MapperRefusalHoldsNoText = AssertNoTextDeep<MapperRefusal>

/**
 * 🟢 THE SHARED VOCABULARY, PINNED IN BOTH DIRECTIONS.
 *
 * ⚠️ THE OBVIOUS FORM OF THIS CONTROL IS BROKEN AND IT IS WORTH SAYING WHY.
 * `Extract<ReaderRefusal, {kind:'contract_violation'|…}>` SILENTLY NARROWS when
 * the reader renames an arm — `Extract` just drops the missing member and the
 * assertion still passes. That is §5.6 inside the control written to prevent
 * §5.3. Two explicit assertions against a locally written literal union catch a
 * rename on EITHER side.
 */
type SharedSeamRefusalKind =
  | 'not_implemented'
  | 'contract_violation'
  | 'response_truncated'
  | 'response_exceeded_byte_cap'
  | 'transport_failed'
  | 'candidate_index_out_of_range'
  | 'model_rejected_by_policy'

export type _SharedSeamKindsAreReaderRefusalKinds = Assert<
  SharedSeamRefusalKind extends ReaderRefusal['kind'] ? true : false
>
export type _SharedSeamKindsAreMapperRefusalKinds = Assert<
  SharedSeamRefusalKind extends MapperRefusal['kind'] ? true : false
>

/**
 * Provider-reported token counts, REUSED. `ReaderTokenUsage`
 * (`model/reconciliation.ts:2300`) is the same concept with the same four fields
 * and the same `${providerRequestId}#${meter}` idempotency consequence. The name
 * says "Reader" and that is a wart; a wart is cheaper than a second vocabulary,
 * and renaming it is a change to applied code with its own diff.
 * It is deliberately NOT deep-asserted, for the reason its own comment gives:
 * `providerRequestId` IS a plain string, and it is transport metadata read from
 * the SDK, never from generated content.
 */
export type MapperOutcome =
  | { kind: 'verdict'; requestOrdinal: number; verdict: MapperVerdict; usage: ReaderTokenUsage | null }
  | { kind: 'refused'; requestOrdinal: number; refusal: MapperRefusal; usage: ReaderTokenUsage | null }
```

### 2.10 The seam function, and the honest stub (G118)

```ts
/**
 * THE SEAM. The caller supplies an implementation; this module never does.
 *
 * The implementation's obligations, in order, none skippable, every one OUTSIDE
 * this module because every one needs authority, identity or a clock:
 *
 *  1. `authorize()` (`model/access.ts:1610`) mints an `AuthorizationGrant`.
 *     Nothing else mints one (invariant 10). The probe that produced the
 *     `ObservedSchema` is itself an enumerated act under `REQUIRES_ENUMERATION`
 *     (`model/governance.ts:497`) against ONE named `SourceDocumentId` — C15.
 *  2. `request.candidateMaxDataClass` is at or below
 *     `ModelUseConfig.maxDataClassInPrompt`. ⚠️ `resolveModel()` DOES NOT CHECK
 *     CLASSIFICATION and people will assume it does.
 *  3. `resolveModel()` (`model/catalog.ts:184`) with `allowedModels`,
 *     `allowedRegions` and `requireZeroRetention` from
 *     `EffectivePolicySet.modelUse`. ⚠️ THERE IS NO MODEL IDENTIFIER LITERAL IN
 *     THIS MODULE AND THERE MUST NEVER BE ONE — G104, and a bare string skips
 *     invariant 7's only executable enforcement.
 *  4. On `{ ok: false }`: return `{ kind: 'refused', refusal:
 *     { kind: 'model_rejected_by_policy' } }`. NO FALLBACK.
 *  5. Refuse BEFORE parsing on a byte cap or a truncated stop reason — truncated
 *     JSON that happens to parse is the worst case, because it parses. ZERO
 *     retries on `contract_violation`: retrying with a different prompt is
 *     negotiating with the input. At most one transport retry, reusing the
 *     idempotency key or it double-meters.
 *  6. Emit the audit and access rows. ⚠️ Nothing may write a chained row until
 *     JCS canonicalisation is in place — G20 (applied 9 Aug; verify before use).
 *  7. Persist the outcome keyed by `(observedSchemaId, requestOrdinal)`, which is
 *     what makes a retry granular and a re-review a REPLAY rather than a re-ask.
 *     G120's adjustment, inherited.
 *
 * Nothing above is enforceable from inside this module, and saying so is part of
 * the deliverable. What IS enforceable from here is that this module cannot do
 * any of it wrongly, because it cannot do any of it at all.
 */
export type SchemaMapper = (request: MapperRequest) => MapperOutcome

/**
 * 🛑 THE UNIMPLEMENTED SIDE OF THE SEAM. THIS IS A STUB AND IT SAYS SO. G118.
 *
 * It returns a REFUSAL, not a fabricated value. The failure mode this exists to
 * prevent is `{ kind: 'no_field' }` — a fabricated "the model found nothing" that
 * is indistinguishable from a working integration finding nothing, so a broken
 * mapper reads as an unmappable file and the FDE maps it by hand forever without
 * ever learning the executor is missing. `CLAUDE.md` forbids inventing data or
 * mocking an API; a refusal is neither.
 *
 * The Bedrock `InvokeModel` call belongs behind this signature, in the data-plane
 * worker (G107), with the seven obligations above discharged in order.
 */
export function notImplementedMapper(request: MapperRequest): MapperOutcome {
  return {
    kind: 'refused',
    requestOrdinal: request.requestOrdinal,
    refusal: { kind: 'not_implemented' },
    usage: null,
  }
}
```

### 2.11 Building the requests, and folding the verdicts

```ts
export interface MapperRequestBuild {
  readonly requests: readonly MapperRequest[]
  /** Columns that produced NO request, each with the named reason. */
  readonly skipped: readonly {
    readonly ordinal: number
    readonly reason: MapperRefusal
  }[]
  readonly boundDefects: readonly BoundDefect[]
}

/**
 * Builds ONE request per observed column. Pure, total, no clock, no id minting.
 *
 * THREE REFUSALS THAT ARE NOT OPTIMISATIONS:
 *  · `fields.length === 0` → `document_type_declares_no_fields` for EVERY column
 *    and zero requests. O-3, fail-closed.
 *  · a column whose `shape` is suppressed → `column_shape_suppressed`. There is
 *    nothing to reason over, and sending the header alone would be asking a model
 *    to guess from a name — which is the "quiet variant" I1 warns about.
 *  · `candidates.length > bound.maxCandidateFields` → the column is SKIPPED, not
 *    trimmed. `buildReaderRequests` states the same rule for the same reason
 *    (`model/reconciliation.ts:2380-2384`): a cap is a ceiling, and silently
 *    truncating the candidate set would make an arbitrary subset look like the
 *    whole one.
 *
 * A NON-EMPTY `boundDefects` PRODUCES NO REQUESTS AT ALL. An unstated bound
 * refuses the probe; it does not run it unbounded (§5.6, and O-8).
 *
 * ⚠️ THE CANDIDATE SET IS NARROWED BY `dataType` VIA `CODEC_TARGET_FOR_DATA_TYPE`
 * AND BY NOTHING ELSE. It is NOT narrowed by `ObservedKey.inferredType` — a
 * probe's guess must not remove the right answer from the candidate list, which
 * is §5.1's shape (a rule keyed on a convenient landmark) applied to a
 * containment set. `inferredType` travels ON the request as evidence.
 */
export function buildMapperRequests(
  schema: ObservedSchema,
  fields: readonly FieldSpec[],
  candidateMaxDataClass: DataClass,
  bound: IngestBound,
): MapperRequestBuild

/**
 * One proposed target/source/codec triple, with the row its evidence came from.
 *
 * ⚠️ ONE NAME FOR THIS, NOT TWO. An earlier draft of this design had
 * `DraftMappingEntry` returned by the fold and `SchemaMappingEntry` stored on the
 * proposal — the same shape with two names, which is §5.3 at the smallest
 * possible scale. There is one type; the proposal record wraps it.
 *
 * `target` IS `FieldPath` AND THE MODEL NEVER SUPPLIED IT. It is resolved by
 * `applyMapperVerdicts` from `request.candidates[verdict.candidateIndex]
 * .fieldPath`, so the path provably came from our own candidate set — the
 * privileged-side resolution `ReaderCandidate.ref` performs
 * (`model/reconciliation.ts:2185-2186`). That is why the deep proof below omits
 * it rather than the field being dropped.
 *
 * `observedOn` is REQUIRED-AND-NULLABLE and null is REFUSED by
 * `validateSchemaMappingProposal()`, not by the compiler — `ObservedScopeValue`'s
 * polarity and its reason (`model/learning.ts:487-495`): a proposal arrives as
 * JSON over a wire the compiler does not run on. G131: one unprovenanced entry
 * refuses the WHOLE proposal.
 */
export interface SchemaMappingEntry {
  readonly target: FieldPath
  readonly source:
    | { readonly kind: 'observed_key_index'; readonly index: number }
    | { readonly kind: 'absent' }
  readonly codec: ValueCodec
  readonly observedOn: ItemRef | null
  readonly confidenceBasisPoints: number
}

/**
 * 🟢 The entry holds no text but the path it was handed. `target` is exempted BY
 * NAME because `FieldPath = string` (`model/kernel.ts:423`) is a naked alias and
 * no proof can distinguish it from prose. Branding `FieldPath` — which is also
 * G106's unapplied JSONB half — would let this `Omit` be deleted.
 */
export type _SchemaMappingEntryHoldsNoTextBesideItsPath =
  AssertNoTextDeep<Omit<SchemaMappingEntry, 'target'>>

export interface MapperApplication {
  readonly entries: readonly SchemaMappingEntry[]
  readonly unresolved: readonly {
    readonly requestOrdinal: number
    readonly refusal: MapperRefusal
  }[]
  readonly meterFacts: readonly MeterFact[]
}

/**
 * Folds outcomes into draft entries. Pure; validates EVERY index.
 *
 * THE TWO BOUNDS CHECKS ARE THE CONTAINMENT ENFORCEMENT POINT, and there are two
 * where the reader has one. A verdict naming an index outside `candidates` or
 * outside `codecs` is converted to a REFUSAL and not to a lookup — under
 * `noUncheckedIndexedAccess` the naive read is `T | undefined`, and an undefined
 * candidate silently skipped is A9(d) reintroduced at the seam
 * (`model/reconciliation.ts:2442-2446`).
 *
 * A THIRD CHECK THE READER HAS NO ANALOGUE FOR: the chosen codec's `kind` must
 * equal `CODEC_TARGET_FOR_DATA_TYPE[candidate.dataType]`, or
 * `codec_target_disagrees_with_field`. A `text` codec on a `money` field is how a
 * running-balance column becomes an amount without anything refusing — A4's
 * attack, one layer up.
 *
 * `several`, `no_field` and `unreadable` produce NO ENTRY. The mapper's job is to
 * confirm one field or to say it cannot; anything else is a finding for a human.
 *
 * Token facts go through `tokenMeterFacts` (`model/reconciliation.ts:2558`) and
 * are provider-reported or absent — never estimated. Invariant 5: facts, unpriced.
 */
export function applyMapperVerdicts(
  requests: readonly MapperRequest[],
  outcomes: readonly MapperOutcome[],
  sample: SampleSelection,
): MapperApplication
```

### 2.12 The proposal record and its validator (C11)

```ts
/**
 * THE INERT ARTEFACT. A nomination, never a decision and never a write.
 *
 * G5 / R2: the model NOMINATES, a human PROMOTES, the promoter is never the
 * proposer and never an agent. This record has no `approved` field and no
 * `active` field on purpose — promotion mints a DIFFERENT object under
 * `promote_field_mapping` [authority] (C14), and a boolean on the proposal would
 * make "approved" a mutation of the thing being reviewed.
 *
 * ⚠️ CONSTRUCTED BY THE CALLER, NEVER BY THIS MODULE. `id`, `proposedBy` and
 * `proposedAt` need a minter, an identity and a clock, and this module has none
 * of the three. That is the `MeterFact`-versus-`UsageRecord` split
 * (`model/reconciliation.ts:2513-2520`).
 *
 * `proposedBy` REUSES `ProposalActor` (`model/domain.ts:3371`), whose agent arm
 * carries a BRANDED `modelId: ModelCatalogEntryId` — branded on 7 Aug precisely
 * so "a proposal record that names a model by an unresolvable string cannot be
 * audited against the residency policy in force when it was made". A second
 * actor union here would be §5.3 and would lose that property.
 *
 * 🛑 AND THE AGENT ARM IS NOT CONSTRUCTIBLE AT SOURCE ONBOARDING TODAY. It
 * requires `stepId: ProcedureStepId` (`model/domain.ts:3375`), and a procedure is
 * walked per EXCEPTION — there is no procedure, no step and no exception at
 * onboarding. This is the SAME structural hole the reader seam records for
 * `AuditActor` (`model/reconciliation.ts:2140-2155`), one act earlier. ⚠️ DO NOT
 * LAUNDER IT INTO `{ kind: 'user' }` with the FDE's own id: that attributes a
 * model's nomination to a person, which is exactly the attribution failure
 * `AuditEvent.actor` exists to stop (`model/domain.ts:3355-3356`), and it would
 * make R2's "the promoter is never the proposer" unverifiable from the row.
 * The fix is the owner's — either onboarding gets a procedure step, or
 * `ProposalActor` gains an arm — and it is stated here rather than typechecked
 * around. UNTIL IT IS TAKEN, ONLY A HUMAN-AUTHORED MAPPING IS RECORDABLE, which
 * is coincidentally the only kind that exists while the seam has no executor.
 */
export interface SchemaMappingProposal extends TenantScoped {
  readonly id: SchemaMappingProposalId
  readonly observedSchemaId: ObservedSchemaId
  readonly documentTypeId: DocumentTypeId
  readonly headerSetHash: HeaderSetHash
  readonly digest: ContentDigest
  readonly entries: readonly SchemaMappingEntry[]
  readonly proposedBy: ProposalActor
  readonly proposedAt: Timestamp
}

/**
 * Why a proposal is unusable. A FACT ABOUT THE PROPOSAL, reported once per
 * defect, never a boolean and never a throw.
 */
export type SchemaMappingDefect =
  /** G131. One unprovenanced entry refuses the whole proposal. */
  | { kind: 'entry_without_observation_provenance'; entryIndex: number }
  | { kind: 'target_not_declared_by_document_type'; entryIndex: number }
  | { kind: 'duplicate_target'; entryIndex: number }
  | { kind: 'duplicate_source_index'; entryIndex: number }
  | { kind: 'source_index_out_of_range'; entryIndex: number }
  | { kind: 'codec_target_disagrees_with_field'; entryIndex: number }
  /** A required `FieldSpec` mapped to `absent`, or not mapped at all. */
  | { kind: 'required_field_unmapped'; fieldIndex: number }
  /** The proposal cites a header set the schema does not have. O-5's selector. */
  | { kind: 'header_set_hash_disagrees_with_schema' }
  | { kind: 'observed_schema_disagrees' }
  /** No entry at all. An empty proposal is not a proposal (`values: []`'s shape). */
  | { kind: 'no_entries' }

export type _SchemaMappingDefectHoldsNoText = AssertNoTextDeep<SchemaMappingDefect>

/**
 * Total. Returns every defect, not the first — an FDE fixing one at a time is an
 * FDE making six round trips. `LearnedRuleDefect`'s posture
 * (`model/reconciliation.ts:3091-3096`): report the authoring defect once, about
 * the rule, rather than N times about rows.
 */
export function validateSchemaMappingProposal(
  proposal: SchemaMappingProposal,
  schema: ObservedSchema,
  fields: readonly FieldSpec[],
): readonly SchemaMappingDefect[]
```

### 2.13 The two new ids, and the three files that must change with them

**`model/kernel.ts`** — insertion point: after `SourceDocumentId` (`model/kernel.ts:103`), in
the consolidated id block:

```ts
export type ObservedSchemaId = Id<'ObservedSchema'>
export type SchemaMappingProposalId = Id<'SchemaMappingProposal'>
```

**`model/identity.ts`** — two entries in `_BrandArgumentsNameTheirEntities` (`:213`) and the
matching `_EntitiesCarryTheirOwnIdentity` slice:

```ts
  ObservedSchema: ObservedSchemaId
  SchemaMappingProposal: SchemaMappingProposalId
```

⚠️ **That map is hand-maintained, so OMITTING an entry is silent to `tsc`.** The only thing
that catches an unregistered brand is `tools/planner/extract.mjs`'s
`brand_without_interface` gap — which the 9 Aug commit message records as having gone to zero
gap kinds, and which the same message records as **unable to distinguish the right fix from
the wrong one**. Add both entries deliberately.

🛑 **DO NOT MINT `SchemaMappingId` HERE.** C8's `SourceDocument.mappingVersionId` needs it and
C14's promoted `SchemaMapping` interface is where it belongs. A brand declared now, with no
interface, is exactly the dangling brand fixed on 9 Aug — `NormalisedDescriptionId =
Id<'NormalisedDescription'>` with no such interface anywhere
(`model/learning.ts:418-420`). Mint the id in the commit that mints the interface.

---

## 3. WHAT EACH DECLARATION REFUSES, AND WHAT FAILS CLOSED

| Declaration | Refuses | Fails closed how |
|---|---|---|
| `_ColumnProfileHoldsNoTextDeep` | any `string` at any depth in the profile | a value cannot reach the mapper — **compile error, not review** |
| `_UntrustedHeaderCarriesNothingButTheHeaderText` | a second text field beside the name | `firstValue: string` is a compile error |
| `_MapperRequestQuarantinedHalfHoldsNoTextDeep` | new text anywhere on the request outside the two named fields | the exemption cannot grow silently |
| `_MapperRequestCarriesExactlyOneHeader` | a plural header arm | batching is a compile error, not a code review |
| `_MapperVerdictHoldsNoTextDeep` | a key name, a path, a format string, a pattern, a rationale on the way back | the output alphabet stays indices |
| `_NoCodecArmCarriesOps` + not importing `ExtractionOp` | an `IdentifierNormalisation` proposed by the model | R3 total, including the two ops that carry no string |
| `_ValueCodecKindsAreCodecTargets`, `_CodecTargetsAreExtractedScalarKinds` | a codec producing something `ExtractedScalar` cannot hold | a rename in `domain.ts` is a compile error here |
| `_SharedSeamKinds…` ×2 | a refusal vocabulary drifting from the reader's | a rename on **either** side is a compile error |
| `CODEC_TARGET_FOR_DATA_TYPE` | an unhandled `DataType` member | missing key → TS2739/TS2741 at the declaration |
| `validateIngestBound` | a bound with no number | **no requests are built at all**; the probe refuses |
| `selectSample` | a file smaller than the sample demand; a non-hex digest; any unstated size | a refusal value; never a silent overlap, never a zero seed |
| `minDistinctValuesToProfile` | disclosing the shape of a low-cardinality column | `suppressed_low_cardinality`, and `buildMapperRequests` then emits **no request** |
| `buildMapperRequests` on `fields.length === 0` | a request against a document type with no declared fields | O-3 fail-closed; matches `DENY_ALL`/G100 |
| `buildMapperRequests` on `candidates.length > cap` | trimming a candidate set | the column is skipped with a named reason |
| `applyMapperVerdicts` index checks ×2 | an out-of-range candidate or codec index | a refusal, never a lookup (`noUncheckedIndexedAccess`) |
| `applyMapperVerdicts` codec/dataType check | a `text` codec on a `money` field | `codec_target_disagrees_with_field` — A4's attack |
| `validateSchemaMappingProposal` | an entry with no `observedOn`; a duplicate target; a required field unmapped; a header-set mismatch | G131: one unprovenanced entry refuses the whole proposal |
| `notImplementedMapper` | a fabricated `no_field` | a `not_implemented` refusal that is visibly different from "nothing matched" |
| `ValueCodec.money` carrying no currency | a model denominating a population | C16 in the type |

**What fails OPEN and is stated rather than hidden:** `confidenceBasisPoints` is unenforced
as non-load-bearing (§5.1's shape, recorded once, as the reader records it); the pack-authored
`label`/`fieldPath` are trusted because G110's publication seam does not exist; and `FieldPath`
being a naked alias means two text sites are named in prose because no grep or proof can see
them.

---

## 4. THE FIXTURES, AND WHY `tsc` ALONE WOULD TELL NOBODY ANYTHING

§5.10 (`docs/HANDOFF.md:1689`): *a total record with no construction site.* Everything in §2
except `CHARACTER_CLASS_INDEX`, `CHARACTER_CLASS_LABEL` and `CODEC_TARGET_FOR_DATA_TYPE` is a
**type**, and nothing in `model/` constructs a `MapperRequest`, an `ObservedSchema` or a
`SchemaMappingProposal`. **So if you add a field and `tsc` stays green, the compiler has told
you nothing.** Say that in the commit message rather than reporting a green run as
verification.

**`model/examples.ts`** — fixtures, in the same commit, following the precedent of
`narrowLiveAutonomy` (`model/examples.ts:847` region) and the permitting
`ManagedServiceUseConfig` added 9 Aug, whose own comment is the argument: *"a resolver tested
only against a config that refuses everything cannot distinguish 'the control works' from
'the control refuses everything'."*

| Fixture | Why it must exist |
|---|---|
| `statedIngestBound: IngestBound` | every field stated; the only witness that the record is constructible at all |
| `unstatedIngestBound: IngestBound` | at least one zero/non-integer; the arm that proves `validateIngestBound` can produce a defect |
| `observedTabularSchema: ObservedSchema` | four columns: an amount-shaped, a date-shaped, a reference-shaped, and a **suppressed low-cardinality** one. Without the suppressed arm nothing witnesses the k-anonymity floor |
| `observedHeaderlessSchema: ObservedSchema` | headers `col1..col4`, `truncated: false` — O-4's stated cost made concrete rather than asserted |
| `amountColumnMapperRequest: MapperRequest` | one request, candidates built from a `DocumentType` with a required money field |
| `fieldVerdict / severalVerdict / noFieldVerdict / unreadableVerdict: MapperVerdict` | all four arms constructed; a union with one constructed arm is three untested arms |
| `provenancedProposal / unprovenancedProposal: SchemaMappingProposal` | the second has exactly one `observedOn: null`, so G131's "one entry refuses the whole proposal" has a witness |

**`tests/model/mapper-seam.test.ts`** and **`tests/model/ingest-sampling.test.ts`** — behaviour,
in the shape of `tests/model/learned-dispositions.test.ts`: a header saying what is under test
and why, and a **MUTATIONS RUN** block at the bottom naming each wrong implementation and the
test that caught it (`tests/model/learned-dispositions.test.ts:856-866`).

**Also required in the same commit, or the gate goes red — derived, not remembered:**

- `tests/model/runtime-importability.test.ts:45` `const MODULE_COUNT = 18` → `19`, and the
  literal re-assertion at `:135` (`assert.equal(MODULE_COUNT, 18)`). The file's own comment
  explains why it is a literal: *"a sweep over a mis-globbed or empty list passes while
  asserting nothing."*
- `node tools/check-doc-counts.mjs` will report the three `# 18 modules` lines STALE:
  `CLAUDE.md:64`, `docs/INDEX.md:43`, `docs/screen-pack-ledger.md:28`. Plus every stated
  export count, because `grep -h '^export ' model/*.ts | wc -l` moves from **832**.
- `node tools/planner/extract.mjs` — re-run and report **edges by kind and gaps by kind**
  against the previous run (140 nodes / 249 edges / 0 dangling at `HEAD`). Two new
  `Id<>` aliases and two new interfaces move it.

---

## 5. THE MUTATIONS THAT PROVE EACH CONTROL BITES

Every one is: apply to the file, run the named command, watch the named failure, revert,
verify byte-identical. **A control that has never failed is a comment with extra steps**
(`model/identity.ts:20-23`).

Command for all type-level rows: `npx -y typescript@5.9.3 tsc -p model/tsconfig.json
--noEmit; echo "EXIT: $?"` — as its **own** command, unpiped, absolute paths
(`CLAUDE.md`'s two traps).

| # | Mutation | Expected failure |
|---|---|---|
| R1 | add `readonly mostCommonValue: string` to `ColumnProfile` | **TS2344** — `Type 'ColumnProfile' does not satisfy the constraint 'NoTextDeep<ColumnProfile>'` … `Type 'string' is not assignable to type 'never'` |
| R2 | add `readonly sampleValues: readonly string[]` to `ColumnProfile` | **TS2344**, and this one is the reason the DEEP proof is used: the shallow `AssertNoPlainText` would pass it |
| R3 | change `SkeletonRun.classIndex` to `readonly classIndex: string` | **TS2344** via `ColumnProfile` → `shape` → `skeletons` → `runs` |
| R3b | change `CharacterClass` to a union of the observed characters (`'A' \| '7' \| …`) | ⚠️ **NO ERROR — and that is why the indices are the design, not the assertion.** The catch is `tests/model/mapper-seam.test.ts` asserting `CHARACTER_CLASS_INDEX` values are `number`, plus review. State this limitation; do not claim the proof covers it |
| R4 | add `readonly firstValue: string` to `UntrustedHeader` | **TS2344** on `_UntrustedHeaderCarriesNothingButTheHeaderText` |
| R5 | add `columnName: string` to `MapperVerdict`'s `field` arm | **TS2344** on `_MapperVerdictHoldsNoTextDeep` |
| R6 | add `notes: string` to `MapperVerdict`'s `several` arm | **TS2344** — the rationale edit, named in the docblock |
| R7 | add `readonly filename: string` to `MapperRequest` | **TS2344** on `_MapperRequestQuarantinedHalfHoldsNoTextDeep` |
| R8 | widen `MapperRequest.untrustedHeader` to `readonly UntrustedHeader[]` | **TS2344** — `Type 'false' does not satisfy the constraint 'true'` on `_MapperRequestCarriesExactlyOneHeader` |
| R9 | add `{ kind: 'unknown_codec'; codec: string }` to `MapperRefusal` | **TS2344** on `_MapperRefusalHoldsNoText` |
| R10 | rename `ReaderRefusal`'s `transport_failed` to `transport_error` in `model/reconciliation.ts` | **TS2344** on `_SharedSeamKindsAreReaderRefusalKinds`. ⚠️ Run this one: it is the only evidence the §5.3 pin works, and the naive `Extract<>` form would pass it silently |
| R11 | drop `identifier` from `CODEC_TARGET_FOR_DATA_TYPE` | **TS2741** / **TS2739** — property `identifier` missing in the object literal |
| R12 | rename `ExtractedScalar`'s `'text'` arm to `'string'` in `model/domain.ts` | **TS2322** at `CODEC_TARGET_FOR_DATA_TYPE.string`, and/or TS2344 on `_CodecTargetsAreExtractedScalarKinds`. Proves the map is the join and not decoration |
| R13 | add `{ kind: 'identifier'; ops: readonly { kind: 'trim' }[] }` to `ValueCodec` | **TS2344** on `_NoCodecArmCarriesOps` (`Assert<false>`). ⚠️ Note the deep proof alone does **not** catch this arm — that is why R13 exists |
| R14 | `import type { ExtractionOp } from './reconciliation'` and use it | the grep control `code \| grep -c 'IdentifierNormalisation\|ExtractionOp' → 0` fails. Not a compile error — say "honour-system", never "enforced" |
| N1 | **negative proof**: `// @ts-expect-error` + `type _X = AssertNoTextDeep<MapperRequest>` in the test file | must be **needed**. If someone removes `untrustedHeader` from the request, the directive becomes unused and `tsc` reports **TS2578**. Bites in both directions, as `LearnedDisposition`'s does (`tests/model/learned-dispositions.test.ts:388-394`) |
| N2 | **negative proof**: `// @ts-expect-error` + `AssertNoTextDeep<ObservedColumn>` | pins that `ObservedColumn` holds the header deliberately |
| B1 | `selectSample`: assign held-out positions from the same offset as the sample | `test_sample_and_held_out_are_disjoint` fails |
| B2 | `selectSample`: `stride = 1` (i.e. take the head) | `test_offset_moves_with_the_digest` and `test_sample_is_not_the_first_n_rows` fail |
| B3 | `seedFromDigest` returns `0` instead of `null` on a non-hex digest | `test_a_non_hex_digest_refuses_rather_than_seeding_zero` fails. **This is A8's "first 5 rows" sneaking back in through an error path** |
| B4 | `selectSample` clamps instead of refusing when `rowCount < demanded` | `test_a_file_smaller_than_the_sample_demand_refuses` fails |
| B5 | `applyMapperVerdicts` reads `request.candidates[i]` without the `undefined` check | `test_an_out_of_range_candidate_index_becomes_a_refusal_and_not_a_lookup` fails |
| B6 | `applyMapperVerdicts` skips the codec/`dataType` agreement check | `test_a_text_codec_on_a_money_field_is_refused` fails — A4's attack |
| B7 | `buildMapperRequests` trims the candidate list to the cap | `test_the_candidate_cap_is_a_ceiling_and_not_a_trim` fails (the reader's own test name, `tests/scenarios/export-surface.test.ts:915`) |
| B8 | `buildMapperRequests` builds a request for a suppressed column | `test_a_suppressed_column_produces_no_request` fails |
| B9 | `buildMapperRequests` proceeds with `boundDefects.length > 0` | `test_an_unstated_bound_produces_no_requests` fails |
| B10 | `validateSchemaMappingProposal` reports only the first defect | `test_every_defect_is_reported_not_the_first` fails |
| B11 | `validateSchemaMappingProposal` accepts one `observedOn: null` | `test_one_unprovenanced_entry_refuses_the_whole_proposal` fails — G131 |
| B12 | `notImplementedMapper` returns `{ kind: 'verdict', verdict: { kind: 'no_field' } }` | `test_notImplementedMapper_returns_a_refusal_rather_than_a_fabricated_no_field` fails (the reader's test at `tests/scenarios/export-surface.test.ts:902`, transposed) |

⚠️ **Two mutation classes that will ESCAPE, stated because the 9 Aug commit records an escape
being more instructive than a catch.** (a) R3b above — a class union of characters passes every
proof. (b) A fixture whose skeleton happens to be a prefix of another: the 9 Aug escape was
*"the fixture chosen for 'one character different' was a PREFIX of the enumerated value"*. Pick
skeleton fixtures that differ in **run count**, in **run length** and in **class**, not in one
dimension.

---

## 6. WHAT I DID NOT SOLVE, AND WHAT IT IS BLOCKED ON

1. **Nothing here compiles yet.** I did not write the file and did not run `tsc`. Every
   expected error code in §5 is the code TypeScript emits for that constraint shape, verified
   against the tree's own recorded expectations (`model/reconciliation.ts:2238-2241` for
   TS2344; `tests/model/learned-dispositions.test.ts:390` for TS2578) — **not** by running my
   declarations.
2. **The decoders do not exist, and a codec index nothing decodes is §5.6.** `ValueCodec`
   selects; `decodeDate()` / `decodeDecimal()` / `decodeMoney()` returning result unions are
   the parse area's, and until they land the codec vocabulary is a promise. **A codec member
   with no decoder must not ship** — that is why `monthForm` is absent.
3. **`ObservedSchema` has no producer.** The probe — the deterministic pass that reads a file
   and computes profiles — is not designed here. It needs bytes, a parser and `IngestBound`,
   which is C4/C5's work and DP5's process boundary (no credentials, no database, no egress).
4. **The header-set hash's own definition is unruled** (§7, O-9). C13's drift refusal is
   "exactly equal"; if the hash case-folds or reorders, the refusal is weaker than it reads and
   O-5's selector changes meaning.
5. **The adversarial-grinding property of a content-hash seed is recorded, not fixed.** The
   recommended fix (re-draw the held-out set at promotion with the mapping id in the seed)
   changes C13, not this module.
6. **No ISO 4217 set exists** (`model/policy.ts:806-811`), so C16's "validated against a closed
   ISO set" has nothing to validate against. `matchesThreeLetterUpperCase` is evidence, not
   validation, and is named that way on purpose.
7. **The pack seam is the ceiling on every proof here.** G110's publication validators have no
   call site. A poisoned `DocumentType.fields` satisfies all of §2 and points at the wrong
   fields. Adjudication §8 item 2; unowned.
8. **Correction is still undesigned** (adjudication §8 item 3). C8 makes the blast radius
   enumerable; nothing makes it fixable, and `SchemaMappingEntry` does not change that.
9. **I did not design the promotion object.** `SchemaMapping`, `SchemaMappingId`, expiry,
   firing count, the second-person triggers and `promote_field_mapping` are C13/C14. I
   deliberately did not mint the id, for the dangling-brand reason in §2.13.
10. **Latency and cost are unmeasured** (adjudication §8 items 6 and 7). I invent no number
    anywhere; every bound is required configuration that refuses on absence.

---

## 7. WHAT THIS DEPENDS ON

**G rulings this design implements and does not relitigate:** G5 (nomination and promotion are
two acts) · G20 (nothing writes a chained row until JCS) · G35 (a timed machine-produced record
gets its own identity) · G38/G22 (FDE-set configuration in a pack template, rendered read-only,
no `editableByTenant`) · G56/G59 (source configuration is the FDE's) · G97 (branded ids are
`text`) · G104 (no model identifier in engine code) · G106 (a key with no `FieldSpec` is
unreadable; R1 says what a HEADER is) · G107 (data-plane code) · G110 (the pack seam is the
upstream dependency) · G118 (a typed seam with no executor must say so) · G120 (one untrusted
item per request; batch the transport, not the context; persist keyed by ordinal) · G124 (no
generated pattern is ever compiled, and its cost clause) · G125 (enumerated, never widened) ·
G127's `Exclude<>`-over-`if` technique · G130 (no pattern arm reappears) · G131 (provenance on
every proposed value).

**Invariants, copied and not paraphrased:**

- **4.** *"Classification is declared once, on `FieldSpec`, and everything derives from it."*
  The candidate set is derived from `FieldSpec`; nothing here re-declares a class.
- **6.** *"Ingested content is data, never instruction."* The header is one length-capped
  string per request, and the return alphabet is indices.
- **7.** *"Residency survives inference — `global.*` model routing is rejected outright."*
  No model identifier appears in this module; the executor resolves through the catalogue.
- **10.** *"An act with no authorisation is unrecordable."* This module mints nothing; the
  probe and each request are authorised acts of the caller.
- **1.** *"Tenant scope is derived from the session, never read from a request."* `ObservedSchema
  extends TenantScoped` because it is a persisted row, and **no function here takes a
  tenant id as an argument**.
- **5.** *"Money is always derived."* No price, no cost, no rate; `MeterFact`s only, and
  `ValueCodec.money` carries no currency.

**Owner rulings from the adjudication that must be answered before this can be built:**

| | Needed for | If unanswered |
|---|---|---|
| **O-2** which ceiling governs a page image / a prompt | the caller's check on `candidateMaxDataClass` | the seam still compiles; the **executor** cannot be written, because nobody knows which ceiling to compare against |
| **O-3** there is no document-level `DataClass` | `candidateMaxDataClass` existing at all | my design takes the **recommended** fail-closed reading (max across `DocumentType.fields`; no fields → no request). If the owner rules otherwise, `document_type_declares_no_fields` changes meaning |
| **O-4** may a bounded sample of real VALUES be shown | the whole of §2.6 | **BLOCKING in one direction only.** If O-4 flips to yes, `ColumnProfile`'s proof and `UntrustedHeader`'s isolation are both wrong by design, not by detail |
| **O-5** at what grain is a mapping pinned | `headerSetHash` on the schema, the proposal and the request | already built for the recommended `(sourceEndpointId, headerSetHash)`; a per-source answer makes the field dead weight |
| **O-8** every bound number and floor | `IngestBound`, including `minDistinctValuesToProfile` | **BLOCKING at runtime, deliberately.** No requests are built until the numbers are stated. That is the intended failure |
| **O-9 (new, mine)** what goes into `HeaderSetHash` — order, case, whitespace | C13's "exactly equal" drift refusal | the refusal is weaker than it reads and nobody knows by how much |
| **O-10 (new, mine)** the `ValueCodec` initial membership | which files are mappable at all | named-month dates, non-Gregorian calendars and two-token separators are inexpressible. G124's cost clause covers it; the owner should see the list |
| **O-11 (new, mine)** how an AGENT proposer is recorded at onboarding — a procedure step, or a new `ProposalActor` arm | `SchemaMappingProposal.proposedBy` for a model-authored proposal (F-11) | the seam compiles and only a HUMAN-authored mapping is recordable. R2's proposer ≠ promoter is unverifiable from the row for the agent case. Gates the executor, not the seam |

O-1, O-6 and O-7 do not gate this module.

---

## 8. THINGS AT THE TREE THAT CONTRADICT OR SHARPEN THE ADJUDICATION

Each verified this session.

**F-1 — `DataType` and `ExtractedScalar['kind']` are two spellings of one value set, and
nothing crosses them.** `DataType = 'string' | …` (`model/domain.ts:645`) versus
`ExtractedScalar` `{kind:'text'}` (`model/domain.ts:1821`). `grep -rn 'DataType' model/*.ts`
returns exactly two lines — the declaration and `FieldSpec.dataType` (`:1720`) — so the
divergence has never been crossed, and a mapper is the first thing that must cross it. This is
a live §5.3 instance no team named. `CODEC_TARGET_FOR_DATA_TYPE` is a stopgap that names it.

**F-2 — C9's "which nothing in the tree does today" needs the word *deep*.** The shallow
request-path proof exists: `AssertNoPlainText<CarriedTurn>` (`model/identity.ts:1189`), on
*"what the model sees of a prior turn"* (`:1109`). §1a.

**F-3 — the `DataClass` ordering is at FOUR copies, in the tree's own words, and the
adjudication reads as if `mayAdmit()`'s were reusable.** `model/policy.ts:1693-1706`:
*"⚠️ THIS IS THE THIRD COPY IN `model/` AND SAYING SO IS THE POINT … `mayAdmit()` above holds
a fourth as a function-local `order`. That is `docs/HANDOFF.md` §5.3 exactly … It is NOT
unified here, deliberately."* R2/C14's *"reusing `mayAdmit()`'s existing ordering rather than
minting a second ladder"* would be minting a **fifth** unless the unification commit lands
first. This design therefore ranks nothing.

**F-4 — a citation that resolves and points at nothing, inside the note about §5.3.**
`model/policy.ts:1695` cites *"`learning.ts:1721` holds `DATA_CLASS_RANK`"*. Verified:
`grep -n 'DATA_CLASS_RANK' model/learning.ts` → **1773**; line 1721 is inside
`CrossBoundarySignal`. The class `tools/check-citations.mjs` structurally cannot catch — the
adjudication logs three instances of it; this is a fourth, and it is one module citing
another.

**F-5 — `ProfileSkeleton` provenance cannot be an `ExceptionId`, so C11's `observedOnSampleRowId`
needs a currency the adjudication did not name.** G131's provenance is an `ExceptionId` because
*"that is the row a human is SHOWN"* (`model/learning.ts:497`). At source onboarding there is
no exception and no residue row. `ItemRef` (`model/reconciliation.ts:785`) is already
`{sourceDocumentId, lineIndex}` and is the right currency — no new type.

**F-6 — an aggregated profile has no single witness row**, so *"every proposed entry carries
the id of the sample row the evidence was observed on"* (R2, per G131) needs the witness to sit
on the **skeleton**, not on the entry, and to be carried up by the privileged side. §2.5.

**F-7 — C16's "closed ISO set" does not exist.** `model/policy.ts:806-811` records, and
refuses a derivation because of, the absence of any ISO 4217 table in this repository. Any
control that says "validated against a closed ISO set" is unbuildable until one lands.

**F-8 — `resolveManagedService()` exists and has no production caller** (`model/policy.ts:1781`,
`docs/HANDOFF.md:139-144`). The adjudication's C1 *"WRITE THIS FIRST"* is done; its
*"land a construction site in the same commit"* half was honoured
(`model/examples.ts`, the permitting `ManagedServiceUseConfig`). Nothing in my area calls it,
and this module must not.

**F-9 — three doc lines and three test literals move when a nineteenth module lands**:
`CLAUDE.md:64`, `docs/INDEX.md:43`, `docs/screen-pack-ledger.md:28`, and
`tests/model/runtime-importability.test.ts:45`/`:135`. Not a contradiction — a cost of the
module choice, stated so nobody is surprised by a red gate.

**F-11 — a model-authored `SchemaMappingProposal` has NO CONSTRUCTIBLE PROPOSER, and this is
the reader seam's `AuditActor` hole one act earlier.** `ProposalActor`'s agent arm requires
`stepId: ProcedureStepId` (`model/domain.ts:3375`); a procedure is walked per exception
(`ProcedureStepExecution` is keyed on `exceptionId`, per `model/reconciliation.ts:2141-2144`),
and at source onboarding there is no exception. So R2's *"the proposer is never the promoter"*
is **unrecordable for an agent proposer today**. No team raised it. The tempting fix —
`{ kind: 'user', userId: <the FDE> }` — attributes the model's nomination to a person and is
refused on `model/domain.ts:3355-3356`'s own reasoning. This is a **new owner ruling** and it
gates the executor, not the seam. ⚠️ Note also that `onBehalfOf` carries `assignmentId: string`
and `policyId: string` (`:3399-3400`) — two bare strings where branded ids exist, which is a
separate finding for whoever audits that union.

**F-10 — the reader seam's own no-plural-arm property is asserted by nothing.**
`model/reconciliation.ts:2174-2176` states it in prose. `_MapperRequestCarriesExactlyOneHeader`
is the line the reader should also carry; G120 claims *"two independent mechanisms holding one
property"* and today the type-level one is a comment.
