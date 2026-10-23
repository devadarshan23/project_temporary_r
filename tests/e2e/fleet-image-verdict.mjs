/**
 * THE FLEET VERDICT — the JUDGEMENT half of `probe-deployed-image.mjs`, and
 * the whole of W0-c.
 *
 * ┌─ 🛑 THE PROBE ASKED EACH SERVICE ABOUT THE STACK AND NEVER THE TWO ────────┐
 * │ SERVICES ABOUT EACH OTHER, AND THE TWO QUESTIONS HAVE DIFFERENT ANSWERS.   │
 * │                                                                            │
 * │ The Deploy stage deploys the **control plane first**, so an abort between  │
 * │ the two calls leaves the **data plane on the previous image** — and the    │
 * │ data plane is the one that publishes to the run queue and reads the        │
 * │ control roster. **Against the stack alone that fleet is indistinguishable  │
 * │ from a healthy post-pipeline one**: `completion-plan.md` §5 W0-c states it │
 * │ as *"two DRIFT lines and exit 1 — identical in shape to a healthy          │
 * │ post-pipeline fleet"*, and §8 tells a reader to check by hand *"until W0-c │
 * │ lands"* because **its exit code cannot tell you.**                         │
 * │                                                                            │
 * │ WITNESSED RED BEFORE IT WAS WRITTEN, against this file carrying the        │
 * │ stack comparison alone — `tests/e2e/fleet-image-verdict.test.mjs` §5:      │
 * │                                                                            │
 * │   ✖ §5 a split fleet and a uniformly-behind fleet are not the same answer  │
 * │     AssertionError: same number of drift lines, and it must not be the     │
 * │     same verdict                                                           │
 * │       actual: 'drift', expected: 'drift', operator: 'notStrictEqual'       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 WHY THIS IS A MODULE AND NOT FIVE LINES INSIDE THE LOOP ───────────────┐
 * │ The plan sizes W0-c at five lines, and five lines inside the loop would be │
 * │ correct and **unprovable**: the probe reaches a live AWS account, so G108  │
 * │ keeps it out of the gate for ever and its judgement would be exercised     │
 * │ only by whoever happened to run it against a broken fleet. **The           │
 * │ condition G108 attaches is a fact about the FETCHING, not about the        │
 * │ JUDGEMENT.** Split them and the judgement becomes a pure function of four  │
 * │ strings per service, assertable with no credential and no network —        │
 * │ **and the probe gains no fifth AWS call, because every value below is      │
 * │ already in hand inside the existing loop.**                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NOTHING HERE FETCHES, SHELLS OUT, READS AN ENVIRONMENT VARIABLE OR TOUCHES
 * A CLOCK. That is what lets `npm test` glob the suite beside it, and it is the
 * property to preserve: the first `spawnSync` added to this file takes the
 * control back out of the gate.
 */

/**
 * One image as the probe learns it.
 *
 * ⚠️ `uri` AND `tags` ARE NOT TWO SPELLINGS OF ONE FACT. The pipeline registers
 * a task definition **by digest** and the stack names a **tag**, so the two
 * sides of every comparison below arrive in different forms and are comparable
 * only through the tag set ECR holds for those bytes.
 *
 * @typedef {{ uri: string, tags: string[], pushedAt: string, gone: boolean }} ImageFact
 * @typedef {{ name: string, running: ImageFact, owned: ImageFact }} ServiceFact
 */

export const FLEET_VERDICT = {
  /** Every service on the image CloudFormation owns. */
  agree: 'agree',
  /** Every service on the SAME image, and it is not the stack's. One fact. */
  drift: 'drift',
  /** The services on DIFFERENT images from each other. The dangerous one. */
  split: 'split',
}

/**
 * 🛑 **`2` IS ABSENT AND THE ABSENCE IS DELIBERATE.** The probe already exits 2
 * for *could not answer* — a failed `aws` call, a task definition with two
 * images, a family the stack does not carry. A verdict reusing it would make
 * *the fleet is broken* and *the probe is broken* one number, which is the
 * defect this slice exists to end, one layer up. `tests/e2e/fleet-image-verdict.test.mjs`
 * §6 asserts the three are distinct and that none of them is 2.
 */
export const FLEET_EXIT_CODE = {
  [FLEET_VERDICT.agree]: 0,
  [FLEET_VERDICT.drift]: 1,
  [FLEET_VERDICT.split]: 3,
}

/**
 * Today's rule, unchanged to the character: **gone ⟹ disagrees**, then URI
 * equality, then a shared tag.
 *
 * ⚠️ THE `gone` TERM IS NOT A TIDY-UP AND MUST NOT BE FACTORED OUT. An image
 * CloudFormation owns that ECR has expired makes a `cdk deploy` of that stack
 * FAIL at the image pull, which the probe reports as the loud end of the same
 * defect — so an expired image is a finding even when the URIs match.
 *
 * @param {ImageFact} running @param {ImageFact} owned
 */
export function stackAgrees(running, owned) {
  return (
    !owned.gone && !running.gone && (running.uri === owned.uri || running.tags.some((t) => owned.tags.includes(t)))
  )
}

/**
 * Whether two RUNNING services are on the same bytes.
 *
 * 🛑 **ITS POLARITY ON `gone` IS THE OPPOSITE OF `stackAgrees`'s, AND THAT IS
 * THE ONE THING IN THIS FILE MOST LIKELY TO BE "TIDIED" INTO A BUG.** There the
 * question is *would a deploy work*, and an expired image answers no. Here the
 * question is *are these two the same bytes*, and two services on one expired
 * digest are emphatically the same bytes — they are both unpullable, which is a
 * drift finding and not a split one. An expired image has an EMPTY tag set, so
 * a rule that compared tags alone would report every such fleet split;
 * URI equality is checked FIRST for exactly that reason, and
 * `tests/e2e/fleet-image-verdict.test.mjs` §7 is the assertion that keeps it.
 *
 * @param {ImageFact} a @param {ImageFact} b
 */
export function servicesShareAnImage(a, b) {
  if (a.uri === b.uri) return true
  return a.tags.some((t) => b.tags.includes(t))
}

/**
 * The fleet's one verdict.
 *
 * 🛑 **THE SPLIT ARM IS EVALUATED INDEPENDENTLY OF THE DRIFT ARM AND NOT AS A
 * REFINEMENT OF IT.** The cheap shape — *if drifted, then look for a split* —
 * is wrong in the one direction that matters: it makes the split finding rest
 * on a premise about ECR (that a tag is unique within a repository, so two
 * distinct digests can never share one, so a split always shows at least one
 * drift line). **That premise is almost certainly true and it is not this
 * repository's to hold.** Asked separately, the split is reported whether or
 * not the premise holds, and nobody has to have checked it.
 *
 * ⚠️ **PAIRWISE, AND NOT A PARTITION INTO IMAGE GROUPS.** `servicesShareAnImage`
 * is not transitive — a tag set is a set, and A may share a tag with B and B
 * with C while A and C share none — so *"how many distinct images does this
 * fleet run"* has no well-defined answer and *"does any pair disagree"* has
 * one. The fleet is two services today and the loop is written for N.
 *
 * @param {ServiceFact[]} services
 */
/**
 * 🛑 **A FACT WITH NO URI AGREES WITH EVERY OTHER FACT WITH NO URI, SILENTLY,
 * AND THAT IS NOT A HYPOTHETICAL.** The first draft of this slice assembled the
 * probe's facts without carrying `uri` across from `tagsFor()`. Every
 * comparison below became `undefined === undefined`, and the probe answered
 * **AGREE** for a fleet the fixture had handed it as **split** — a control
 * reporting the healthiest possible answer for the most dangerous possible
 * input. It was caught by `probe-deployed-image-render.test.mjs` rather than by
 * reading, which is the argument for that suite existing at all.
 *
 * Throwing is the fail-closed direction: an exception reaches the probe's
 * caller as a non-zero exit nobody can mistake for a verdict, where `false`
 * would have been one more DRIFT line.
 */
function assertReadable(fact, side, name) {
  const image = fact[side]
  if (!image || typeof image.uri !== 'string' || image.uri === '') {
    throw new TypeError(`${name}'s ${side} image carries no uri; a verdict over it would be vacuous`)
  }
  if (!Array.isArray(image.tags)) {
    throw new TypeError(`${name}'s ${side} image carries no tag list; a verdict over it would be vacuous`)
  }
}

export function fleetVerdict(services) {
  for (const s of services) {
    assertReadable(s, 'running', s.name)
    assertReadable(s, 'owned', s.name)
  }

  const perService = services.map((s) => ({ name: s.name, agreesWithStack: stackAgrees(s.running, s.owned) }))

  /** Every pair that is not on the same bytes. Empty is the healthy answer. */
  const pairs = []
  for (let i = 0; i < services.length; i += 1) {
    for (let j = i + 1; j < services.length; j += 1) {
      const left = services[i]
      const right = services[j]
      if (!servicesShareAnImage(left.running, right.running)) pairs.push({ left, right })
    }
  }

  const verdict = pairs.length
    ? FLEET_VERDICT.split
    : perService.some((s) => !s.agreesWithStack)
      ? FLEET_VERDICT.drift
      : FLEET_VERDICT.agree

  return {
    verdict,
    exitCode: FLEET_EXIT_CODE[verdict],
    perService,
    /** Null unless the verdict is `split`, so a reader cannot mistake an empty list for a finding. */
    split: pairs.length ? { pairs } : null,
  }
}
