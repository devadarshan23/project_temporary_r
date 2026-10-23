/**
 * G260 — SIX TAGS ON EVERY RESOURCE, ENFORCED AT SYNTH — AND NO TENANT TAG,
 * EVER.
 *
 * `Project` · `Environment` · `Plane` · `ManagedBy` · `Owner` · `CostCentre`.
 * The ruling enforces them twice: this Aspect, which throws while the template
 * is being written, and AWS Config's managed `required-tags` rule, which
 * catches what the console and the CLI create outside CDK. The Config rule
 * belongs to the `Observability` stack and is NOT in this pass (§16 step 4), so
 * today this file is the only half that exists — stated so nobody reads a green
 * synth as the full control.
 * ⛔ AND THE CONFIG HALF WILL NOT ARRIVE — R15, 1 Oct 2026, THE OWNER'S
 * (`docs/HANDOFF.md` G2441): no account-wide AWS Config recorder, so no Config
 * rule, by decision. The paragraph above is kept as it stood; this Aspect plus
 * its tests IS the full control now, with the console and the CLI outside it by
 * accepted cost.
 *
 * 🛑 WHY THIS IS AN ASPECT AND NOT A REVIEW CHECKLIST. `docs/HANDOFF.md` §5's
 * standing finding is that a rule keyed on a convenient landmark instead of the
 * property it protects is the most common defect in this codebase, and §5.6's
 * is that a control which cannot be witnessed failing is a control that asserts
 * nothing. So: this Aspect is witnessed RED before it is trusted —
 * `infra/test-fixtures/untagged-stack.ts` synthesises a resource with a tag
 * removed and `tests/infra/tagging.test.mjs` requires the synth to FAIL, paired
 * with a positive control on a fully tagged stack that must SUCCEED. A checker
 * that throws unconditionally fails the pair from one side; one that never
 * throws fails it from the other.
 *
 * 🛑 PRIORITY IS LOAD-BEARING, NOT DECORATION. `Tags.of(scope).add()` is itself
 * an Aspect, and it MUTATES. An inspecting Aspect added without a priority runs
 * interleaved with the mutating ones and can read a TagManager before the tags
 * have been written into it — a control that reports a missing tag that is
 * about to be present, or worse, one whose passing means nothing. This Aspect
 * is registered at `AspectPriority.READONLY` (1000) so it runs after every
 * mutating Aspect in the tree. `applyRequiredTags()` below is the only
 * supported way to register it, and it sets the priority for you.
 */

import { Annotations, AspectPriority, Aspects, CfnResource, TagManager, Tags } from 'aws-cdk-lib'
import type { IAspect } from 'aws-cdk-lib'
import type { IConstruct } from 'constructs'

import {
  FORBIDDEN_TAG_KEYS,
  REQUIRED_TAG_KEYS,
  TAG_COST_CENTRE_PLACEHOLDER,
  TAG_OWNER_PLACEHOLDER,
  tagsFor,
} from './config.ts'
import type { Environment, Plane, ResourceTags } from './config.ts'

/** One violation, on one construct. Collected so the error names all of them. */
export interface TagViolation {
  readonly path: string
  readonly cfnType: string
  readonly missing: readonly string[]
  readonly forbidden: readonly string[]
  readonly empty: readonly string[]
}

export class MissingRequiredTagsError extends Error {
  readonly violations: readonly TagViolation[]

  constructor(violations: readonly TagViolation[]) {
    super(
      'G260: six tags on every resource, and these do not carry them.\n' +
        violations
          .map((v) => {
            const parts: string[] = []
            if (v.missing.length > 0) parts.push(`missing ${v.missing.join(', ')}`)
            if (v.empty.length > 0) parts.push(`empty ${v.empty.join(', ')}`)
            if (v.forbidden.length > 0) {
              parts.push(
                `FORBIDDEN ${v.forbidden.join(', ')} — a per-tenant tag is a ` +
                  'tenant enumeration in the clear (G260); no resource may carry one',
              )
            }
            return `  ${v.path} (${v.cfnType}): ${parts.join('; ')}`
          })
          .join('\n'),
    )
    this.name = 'MissingRequiredTagsError'
    this.violations = violations
  }
}

/**
 * The inspector. It reads; it never writes.
 *
 * ⚠️ IT ONLY VISITS RESOURCES CLOUDFORMATION CAN TAG, and that boundary is
 * drawn by `TagManager.isTaggable()` rather than by a hand-maintained
 * exemption list — the artefact `server/contract/routes.ts` refuses for the
 * same reason, because *"it always ends up one entry stale in the wrong
 * direction."* A resource whose CloudFormation type has no `Tags` property
 * (`AWS::S3::BucketPolicy`, `AWS::IAM::Policy`, `AWS::ECR::RegistryPolicy`)
 * cannot carry a tag at all, so requiring one of it would be a rule about the
 * type system rather than about the account.
 */
export class RequiredTagsAspect implements IAspect {
  private readonly violations: TagViolation[] = []

  visit(node: IConstruct): void {
    if (!CfnResource.isCfnResource(node)) return
    if (!TagManager.isTaggable(node)) return

    const values = node.tags.tagValues()
    const missing: string[] = []
    const empty: string[] = []

    for (const key of REQUIRED_TAG_KEYS) {
      const value = values[key]
      if (value === undefined) {
        missing.push(key)
        continue
      }
      if (value.trim() === '') empty.push(key)
    }

    const forbidden = FORBIDDEN_TAG_KEYS.filter((key) => values[key] !== undefined)

    if (missing.length === 0 && empty.length === 0 && forbidden.length === 0) return

    this.violations.push({
      path: node.node.path,
      cfnType: node.cfnResourceType,
      missing,
      empty,
      forbidden,
    })
  }

  /**
   * Called once, after the walk, by `applyRequiredTags()`'s validation hook.
   * Throwing inside `visit()` would report the FIRST violation and hide the
   * rest, which turns one red synth into as many red synths as there are
   * untagged resources.
   */
  assertClean(): void {
    if (this.violations.length === 0) return
    throw new MissingRequiredTagsError([...this.violations])
  }

  get found(): readonly TagViolation[] {
    return this.violations
  }
}

/**
 * Apply the six tags to `scope` and register the inspector that proves they
 * arrived. This is the ONLY supported entry point: it is what guarantees the
 * READONLY priority, and it is what guarantees the inspector is registered at
 * all — a tagged stack with no inspector looks exactly like an enforced one.
 *
 * The throw happens through `Aspects` + an explicit `assertClean()` driven from
 * the stack's own validation, so that `app.synth()` — which is what `cdk synth`
 * and every test here call — is the thing that fails.
 */
export function applyRequiredTags(
  scope: IConstruct,
  environment: Environment,
  plane: Plane,
  overrides?: Partial<ResourceTags>,
): RequiredTagsAspect {
  const tags: ResourceTags = { ...tagsFor(environment, plane), ...overrides }

  for (const [key, value] of Object.entries(tags)) {
    Tags.of(scope).add(key, value)
  }

  if (
    tags.Owner === TAG_OWNER_PLACEHOLDER ||
    tags.CostCentre === TAG_COST_CENTRE_PLACEHOLDER
  ) {
    /* ⚠️ A WARNING, NOT AN ERROR, AND THE DIFFERENCE IS DELIBERATE. G260 says
     * the two values ship as placeholders the owner must fill BEFORE THE FIRST
     * DEPLOY. Failing synth on them would mean the gate could never be green
     * until an owner decision nobody in the gate can take is taken — which is
     * the shape that teaches people to disable a control. It is loud, it is in
     * every synth's output, and `docs/tech-stack.md` §14 carries it as an open
     * item with a named owner. */
    Annotations.of(scope).addWarningV2(
      '@reconcile/g260-placeholder-tags',
      'G260: Owner and/or CostCentre are still the shipped PLACEHOLDERS. The ' +
        'owner must fill them in infra/lib/config.ts before the first deploy ' +
        '(docs/tech-stack.md §14).',
    )
  }

  const aspect = new RequiredTagsAspect()
  Aspects.of(scope).add(aspect, { priority: AspectPriority.READONLY })

  /* 🛑 THE THROW HANGS OFF A VALIDATION, NOT OFF `visit()`, AND THAT IS THE
   * ORDERING THAT MAKES IT WORK. `App.synth()` invokes every Aspect over the
   * whole tree FIRST and validates SECOND, so a validation registered here sees
   * the completed violation list. Throwing from inside `visit()` would report
   * the first untagged resource and hide the rest — one red synth per untagged
   * resource instead of one red synth naming all of them. */
  scope.node.addValidation({
    validate: (): string[] =>
      aspect.found.length === 0 ? [] : [new MissingRequiredTagsError([...aspect.found]).message],
  })

  return aspect
}
