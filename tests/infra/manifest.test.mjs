/**
 * G259's separate manifest, G191's exact pins, and G212's one-command control.
 *
 * 🛑 THE FIRST TEST IS THE LOAD-BEARING ONE AND IT IS ABOUT A FILE THIS SLICE
 * DID NOT WRITE. `aws-cdk-lib` in the ROOT `package.json` would end the property
 * the `Dockerfile` states in its own header — that `npm ci --omit=dev` produces
 * a container holding the driver and no compiler — which is the SAME property
 * G212 refused `@aws-sdk/client-s3` to protect, and G212's row records that the
 * more seductive of the two refusals was the dev-dependency one, *"because it
 * exercises the seam without changing the shipped image, and it therefore ends
 * the no-AWS-resource property without appearing to."* A hoist into the root
 * manifest would look like a tidy-up in a diff. It is not, and this is what
 * makes it a red gate rather than a review conversation.
 *
 * ⚠️ **AND THAT PROPERTY IS NARROWER SINCE 20 Sep 2026 — R-C.** `npm ci
 * --omit=dev` installs `@aws-sdk/client-sqs` and its transitive closure, so
 * the container holds the driver, the SQS client and no compiler. **The `no
 * compiler` half is what this file still protects and is unchanged**;
 * `aws-cdk-lib` in the root manifest would still end it, and the CDK toolchain
 * is an order of magnitude larger than one service client.
 *
 * ⚠️ NO CONSTANT BELOW IS IMPORTED FROM `infra/`. Every expected value is typed
 * into this file.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { INFRA_DIR, REPO_ROOT, synthesisedTemplates } from './support.mjs'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const ROOT_PACKAGE = join(REPO_ROOT, 'package.json')
const INFRA_PACKAGE = join(INFRA_DIR, 'package.json')

/** The compiler options every TypeScript project in this repository carries. */
const SHARED_COMPILER_OPTIONS = {
  strict: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  erasableSyntaxOnly: true,
  verbatimModuleSyntax: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
}

/** Packages that must never appear anywhere in the ROOT manifest. */
const FORBIDDEN_IN_ROOT = ['aws-cdk-lib', 'constructs', 'aws-cdk']

// ------------------------------------------------- 1. G259 and G212's fence

test('test_no_cdk_package_appears_anywhere_in_the_root_manifest', () => {
  const root = readJson(ROOT_PACKAGE)
  const declared = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
    ...(root.optionalDependencies ?? {}),
    ...(root.peerDependencies ?? {}),
  }
  for (const name of FORBIDDEN_IN_ROOT) {
    assert.equal(
      Object.hasOwn(declared, name),
      false,
      `'${name}' is in the ROOT package.json. G259 gives infra/ its own manifest ` +
        "so that 'npm ci --omit=dev' keeps producing a container with the driver " +
        'and no compiler. Move it to infra/package.json.',
    )
  }
})

/**
 * ⚠️ **THIS TEST READ, UNTIL 20 Sep 2026 — AND IT IS QUOTED RATHER THAN
 * DELETED, BECAUSE A CONTROL THAT IS DELETED WHEN IT FIRES IS NOT A CONTROL:**
 *
 *     test('test_the_root_manifest_declares_no_aws_sdk_which_is_g212s_one_command_control', () => {
 *       const source = readFileSync(ROOT_PACKAGE, 'utf8')
 *       assert.equal(
 *         /aws-sdk/.test(source),
 *         false,
 *         "G212: `grep -c 'aws-sdk' package.json` must return 0. The row is discharged " +
 *           'for exactly as long as it does.',
 *       )
 *     })
 *
 * 🛑 **IT WAS RIGHT, AND ITS PREMISE ENDED. R-C, 20 Sep 2026, THE OWNER'S
 * RULING — AND G212 IS DISCHARGED BY ITS OWN CONDITION RATHER THAN
 * OVERTURNED.** That row says on its own face that the SDK is revisited
 * *"when an actual AWS resource exists — which is a fact about the account,
 * not about the code, and so is checkable rather than arguable."* NINE
 * top-level stacks are live in `000000000000`; the command is in
 * `server/data-plane/sqs-run-queue.ts`'s header and it was run read-only.
 *
 * 🛑 **SO THE ASSERTION IS REPLACED BY THE NARROWER PROPERTY THAT SURVIVES,
 * NOT REMOVED**: R-C is *"pinned exact under G191, and server-only"* and takes
 * `@aws-sdk/client-sqs` ALONE. Not `aws-sdk` v2, not the monolith, not
 * `@aws-sdk/client-s3` — `createUpload` is still unmounted for want of an
 * object store, and `server/data-plane/start.ts` says so with a derivation
 * that measures the right thing now.
 */
/*
 * ⚠️ **THIS LIST WAS `['@aws-sdk/client-sqs']` ALONE UNTIL 1 Oct 2026 AND IT
 * IS WIDENED BY A RULING RATHER THAN BY A CONVENIENCE — G2404.** The owner's
 * G2401 puts source credentials in Secrets Manager; the serving process must
 * WRITE one there. The alternatives were measured and refused on the row:
 * hand-rolling SigV4 over `node:crypto` is the hand-rolled-protocol shape G109
 * refuses for YAML, and importing `@smithy/*` out of `client-sqs`'s closure is
 * depending on an UNDECLARED package. `client-secrets-manager` is pinned at
 * `client-sqs`'s exact version, so the two share one transitive closure and the
 * lockfile grew by ONE package. **R-C's narrowness survives as a LIST rather
 * than a single name: two clients, each named, and `client-s3` still absent.**
 */
const PERMITTED_AWS_SDK_PACKAGES = ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-sqs']

test('test_the_root_manifest_declares_exactly_the_one_aws_sdk_client_r_c_took', () => {
  const root = readJson(ROOT_PACKAGE)
  const declared = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
    ...(root.optionalDependencies ?? {}),
    ...(root.peerDependencies ?? {}),
  }
  const names = Object.keys(declared)

  assert.equal(
    names.includes('aws-sdk'),
    false,
    'the AWS SDK v2 MONOLITH is in the root manifest. R-C takes one v3 CLIENT; the ' +
      'monolith is every service at once, which is the opposite of the narrowness the ' +
      'ruling is.',
  )

  const sdkClients = names.filter((n) => n.startsWith('@aws-sdk/')).sort()
  assert.deepEqual(
    sdkClients,
    PERMITTED_AWS_SDK_PACKAGES,
    'R-C is NARROW BY NAME: `@aws-sdk/client-sqs`, and G2404 adds ' +
      '`@aws-sdk/client-secrets-manager` and nothing else. G212 is discharged by ' +
      'its own condition — an AWS resource exists — and NOT widened: taking another client ' +
      'here is a fresh ruling with a fresh argument, and the one most likely to be reached ' +
      'for is `@aws-sdk/client-s3`, which `server/data-plane/start.ts` records as absent by ' +
      `name. Found: ${JSON.stringify(sdkClients)}`,
  )

  for (const name of sdkClients) {
    const range = declared[name]
    assert.match(
      range,
      /^\d+\.\d+\.\d+$/,
      `G191: '${name}' is '${range}' and must be pinned EXACT — no caret, no tilde.`,
    )
  }

  for (const runtime of PERMITTED_AWS_SDK_PACKAGES) {
    assert.equal(
      Object.hasOwn(root.dependencies ?? {}, runtime),
      true,
      `${runtime} must be a RUNTIME dependency, for R-C's reason below.`,
    )
  }
  assert.equal(
    Object.hasOwn(root.dependencies ?? {}, '@aws-sdk/client-sqs'),
    true,
    'R-C takes the SDK as a RUNTIME dependency. G212 records that taking it as a DEV ' +
      'dependency was the more seductive refusal — *"it exercises the seam without changing ' +
      'the shipped image"* — and a client the deployed plane cannot load is a seam that ' +
      'works only in the gate.',
  )
})

test('test_infra_declares_the_cdk_packages_itself', () => {
  const infra = readJson(INFRA_PACKAGE)
  const deps = infra.dependencies ?? {}
  assert.ok(Object.hasOwn(deps, 'aws-cdk-lib'), 'infra/ must declare aws-cdk-lib itself')
  assert.ok(Object.hasOwn(deps, 'constructs'), 'infra/ must declare constructs itself')
  assert.equal(infra.private, true, 'infra/ is not published')
})

// -------------------------------------------------------- 2. G191's pins

test('test_every_infra_dependency_is_pinned_exact_with_no_caret_and_no_tilde', () => {
  const infra = readJson(INFRA_PACKAGE)
  const declared = {
    ...(infra.dependencies ?? {}),
    ...(infra.devDependencies ?? {}),
  }
  const names = Object.keys(declared)
  assert.ok(names.length > 0, 'infra/package.json declares no dependencies at all')
  for (const [name, range] of Object.entries(declared)) {
    assert.match(
      range,
      /^\d+\.\d+\.\d+$/,
      `G191 pins every dependency EXACT; '${name}' is '${range}'`,
    )
  }
})

// ------------------------------------------- 3. the fifth TypeScript project

test('test_infra_tsconfig_carries_the_same_compiler_options_as_the_other_four_projects', () => {
  const infra = readJson(join(INFRA_DIR, 'tsconfig.json'))
  const options = infra.compilerOptions ?? {}
  for (const [key, value] of Object.entries(SHARED_COMPILER_OPTIONS)) {
    assert.equal(
      options[key],
      value,
      `infra/tsconfig.json must set ${key}: ${value} — docs/tech-stack.md §2 and §10`,
    )
  }
})

test('test_infra_tsconfig_extends_nothing_because_none_of_the_five_projects_does', () => {
  const infra = readJson(join(INFRA_DIR, 'tsconfig.json'))
  assert.equal(
    Object.hasOwn(infra, 'extends'),
    false,
    'none of the five tsconfigs extends another, deliberately. The cost is five ' +
      'copies that must be edited together; the test above is what notices when ' +
      'one of them is not.',
  )
})

test('test_the_other_four_projects_still_carry_the_same_options_so_the_parity_claim_is_not_one_sided', () => {
  /* Asserting infra/ matches a list typed into this file proves infra/ matches
   * the list. It does not prove the list is what the repository does. These
   * four are the other side of that. */
  for (const project of ['model', 'server', 'tests', 'frontend']) {
    const config = readJson(join(REPO_ROOT, project, 'tsconfig.json'))
    const options = config.compilerOptions ?? {}
    for (const [key, value] of Object.entries(SHARED_COMPILER_OPTIONS)) {
      assert.equal(
        options[key],
        value,
        `${project}/tsconfig.json sets ${key}=${options[key]}, not ${value}; ` +
          'the five projects have drifted apart',
      )
    }
  }
})

// --------------------------------------------------- 4. G108: one gate, wired

test('test_typecheck_infra_and_synth_infra_are_both_inside_npm_run_check', () => {
  const root = readJson(ROOT_PACKAGE)
  const scripts = root.scripts ?? {}
  const check = scripts['check'] ?? ''
  for (const name of ['typecheck:infra', 'synth:infra']) {
    assert.ok(
      check.includes(name),
      `G259 puts '${name}' inside the gate; check is currently ${JSON.stringify(check)}`,
    )
    assert.ok(Object.hasOwn(scripts, name), `the '${name}' script does not exist`)
  }
})

test('test_the_gate_typechecks_infra_before_it_synthesises_it', () => {
  /* Not cosmetic. `cdk synth` executes `bin/app.ts` through Node's type
   * stripping, which ERASES types without checking them — a type error surfaces
   * as a runtime failure inside CDK or, worse, not at all. Running the compiler
   * first means the synth failure a contributor reads is about the stack rather
   * than about a typo. */
  const check = readJson(ROOT_PACKAGE).scripts?.check ?? ''
  assert.ok(check.indexOf('typecheck:infra') < check.indexOf('synth:infra'))
})

/**
 * Resolve what `npm run <name>` at the root eventually EXECUTES, following one
 * `npm --prefix infra run <other>` hop into `infra/package.json`.
 *
 * ⚠️ WRITTEN BECAUSE THE FIRST VERSION OF THE TEST BELOW READ THE ROOT SCRIPT
 * ONLY AND WENT RED AGAINST A CORRECT TREE. The root script delegates; the flag
 * lives one hop away. Asserting against the delegating text would have been a
 * control that fails when the answer is right and — after somebody "fixed" it by
 * matching the delegation instead — passes when the flag is gone. Follow the
 * hop.
 */
function resolvedScript(name) {
  const rootScripts = readJson(ROOT_PACKAGE).scripts ?? {}
  const text = rootScripts[name] ?? ''
  const hop = /npm\s+--prefix\s+infra\s+run\s+([A-Za-z0-9:_-]+)/.exec(text)
  if (hop === null) return text
  const infraScripts = readJson(INFRA_PACKAGE).scripts ?? {}
  const target = infraScripts[hop[1]]
  assert.ok(
    target !== undefined,
    `root '${name}' delegates to infra script '${hop[1]}', which does not exist`,
  )
  return `${text} => ${target}`
}

test('test_synth_infra_passes_no_lookups_so_the_gate_cannot_reach_the_network', () => {
  const synth = resolvedScript('synth:infra')
  assert.match(
    synth,
    /\bcdk synth\b/,
    `'synth:infra' must end up running 'cdk synth'; it resolves to ${JSON.stringify(synth)}`,
  )
  assert.match(
    synth,
    /--no-lookups/,
    'G108 requires everything in the gate to be deterministic and fast. A ' +
      'context lookup reaches AWS, succeeds on a machine with credentials and ' +
      'fails on one without — the definition of a flaky gate.',
  )
})

/**
 * Source with comments removed.
 *
 * 🛑 THIS FUNCTION EXISTS BECAUSE THE SCAN BELOW FIRED ON ITS OWN PROSE ON THE
 * FIRST RUN. `infra/lib/config.ts` carries a comment saying no construct in this
 * app performs a context lookup — and spelling the call form inside that
 * sentence made the file its own violation. It is precisely the false-positive
 * class `CLAUDE.md` catalogues at length: the `@dropped-for-v1` awk that counted
 * prose ABOUT a drop as a drop, and moved a governed total twice while dropping
 * nothing. A scanner over source must read source.
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

test('test_no_file_under_infra_calls_a_context_lookup', async () => {
  /* The flag above is the belt. This is the braces: `--no-lookups` makes a
   * lookup FAIL rather than making it absent, and a failing gate that a
   * contributor "fixes" by dropping the flag is the shape this record calls a
   * control somebody switched off. */
  const { readdirSync, statSync } = await import('node:fs')
  const offenders = []
  let scanned = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'cdk.out') continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|mjs)$/.test(entry)) continue
      scanned += 1
      // A call, not a mention: the identifier followed by an open paren, in
      // code rather than in a comment.
      if (/\bfromLookup\s*\(/.test(withoutComments(readFileSync(full, 'utf8')))) {
        offenders.push(full)
      }
    }
  }
  walk(INFRA_DIR)
  assert.ok(scanned > 5, `the walk read ${scanned} files; this assertion would pass vacuously`)
  assert.deepEqual(offenders, [], 'these files call a context lookup; synth must stay offline')
})

test('test_the_comment_stripper_above_does_not_hide_a_real_call_and_does_hide_a_mention', () => {
  /* The control on the control. A stripper that returned '' would make the
   * scan above pass over any tree at all. */
  assert.match(withoutComments('const r = ec2.Vpc.fromLookup(this, "V", {})'), /fromLookup\s*\(/)
  assert.doesNotMatch(withoutComments('// never call fromLookup() here'), /fromLookup\s*\(/)
  assert.doesNotMatch(withoutComments('/* never call fromLookup() here */'), /fromLookup\s*\(/)
})

/**
 * 🛑 AWS SERVICES VALIDATE `description` CHARACTER SETS AND `cdk synth` DOES
 * NOT. THIS CLASS HAS NOW COST THREE FAILED DEPLOYS.
 *
 *   · EC2 security groups reject an apostrophe. Three groups carried "G263's"
 *     and the deploy failed with "Invalid security group description".
 *   · IAM roles reject anything outside [\t\n\r, 0x20-0x7E, 0xA1-0xFF] — so
 *     an em-dash or an emoji, which this record's house style uses everywhere
 *     else, fails four roles at once.
 *
 * Both surfaced in CloudFormation, minutes into a real deploy, after a green
 * synth and a green gate. A description is prose, and prose in this repository
 * carries emoji and em-dashes ON PURPOSE — so the fix is not to write duller
 * comments, it is to check the fields AWS validates.
 */
const IAM_SAFE = /^[\t\n\r\x20-\x7e\u00a1-\u00ff]*$/
const SG_SAFE = /^[a-zA-Z0-9. _\-:/()#,@[\]+=&;{}!$*]*$/
/**
 * \u26a0\ufe0f LAMBDA'S DOCUMENTED PATTERN IS `.*`, AND `.*` DOES NOT MATCH A NEWLINE \u2014
 * which is the whole of the trap for this service. A multi-line description is
 * the natural thing to write in a record whose house style is paragraphs, and
 * `cdk synth` accepts one. Added 19 Sep 2026 with G290's key-minting function,
 * the first Lambda in this app.
 */
const LAMBDA_SAFE = /^[^\n\r]{0,256}$/
/**
 * ⚠️ AMPLIFY DOCUMENTS A LENGTH AND NO CHARACTER CLASS — `Pattern: (?s).*`,
 * `MaxLength: 1000` — so the constraint checked here is the one AWS actually
 * publishes and not a stricter one invented to match this list's neighbours.
 * **A rule that asserted a charset AWS does not enforce would refuse prose that
 * deploys perfectly**, which is the mirror of the defect this whole block
 * exists for. Added 22 Sep 2026 with S5's `Amplify` stack, **in the commit that
 * introduces the two types**, which is what the paragraph below demands.
 */
const AMPLIFY_SAFE = /^[\s\S]{0,1000}$/

test('test_every_description_satisfies_the_charset_of_the_service_that_receives_it', () => {
  const checks = [
    ['AWS::IAM::Role', IAM_SAFE, 'IAM rejects anything outside \\t\\n\\r, 0x20-0x7E, 0xA1-0xFF'],
    ['AWS::EC2::SecurityGroup', SG_SAFE, 'EC2 rejects apostrophes and most punctuation'],
    /* ⚠️ THE INGRESS RULE'S OWN `Description` IS A SECOND FIELD EC2 VALIDATES
     * AGAINST THE SAME CHARSET, AND THIS LIST DID NOT COVER IT UNTIL 19 Sep
     * 2026 — added with G293's one ingress rule, the first standalone one in
     * this app. A rule keyed on the SecurityGroup type while the identical
     * validation sits on a different type is the landmark-instead-of-property
     * shape docs/HANDOFF.md section 5 calls the most common defect here. */
    ['AWS::EC2::SecurityGroupIngress', SG_SAFE, 'EC2 rejects apostrophes and most punctuation'],
    ['AWS::Lambda::Function', LAMBDA_SAFE, 'Lambda takes at most 256 characters and no newline'],
    ['AWS::KMS::Key', IAM_SAFE, 'KMS takes 0x20-0x00FF and rejects tab and newline'],
    /* ⚠️ THREE TYPES ADDED 20 Sep 2026 WITH G261's `Observability` STACK, AND
     * THE REASON IS §5.1 RATHER THAN COMPLETENESS. This list had grown one
     * service at a time, each time a deploy failed; a stack introducing three
     * NEW description-bearing types would have reproduced trap 2 exactly,
     * because nothing here keys on "does this resource have a Description" —
     * it keys on a hand-maintained list of types somebody remembered. The
     * repair is not a cleverer rule (CloudFormation publishes no per-property
     * charset this test could read); it is to add the types in the commit that
     * introduces them, which is this one.
     *
     * CloudWatch's `AlarmDescription` and EventBridge's `Description` both
     * document a 1024- and 512-character maximum; neither documents a
     * character class, so the conservative IAM set is applied to both — this
     * record's house style uses em-dashes and emoji everywhere, and an
     * alarm description is prose a responder reads at 3am. */
    ['AWS::CloudWatch::Alarm', IAM_SAFE, 'CloudWatch alarm descriptions are read by a pager'],
    ['AWS::Events::Rule', IAM_SAFE, 'EventBridge rule descriptions take no emoji'],
    ['AWS::SNS::Topic', IAM_SAFE, 'an SNS DisplayName is prefixed to every SMS message'],
    /* ⚠️ TWO TYPES ADDED 22 Sep 2026 WITH S5's `Amplify` STACK, FOR THE REASON
     * THE PARAGRAPH ABOVE GIVES ABOUT THE PREVIOUS THREE: a stack introducing
     * NEW description-bearing types that did not add them here would reproduce
     * trap 2 exactly. See `AMPLIFY_SAFE` for why the rule is a length and not a
     * charset. */
    ['AWS::Amplify::App', AMPLIFY_SAFE, 'an Amplify app description is at most 1000 characters'],
    ['AWS::Amplify::Branch', AMPLIFY_SAFE, 'an Amplify branch description is at most 1000 characters'],
  ]
  let seen = 0
  for (const tpl of Object.values(synthesisedTemplates())) {
    for (const [logicalId, resource] of Object.entries(tpl.Resources ?? {})) {
      for (const [type, re, why] of checks) {
        if (resource.Type !== type) continue
        const d = resource.Properties?.Description ?? resource.Properties?.GroupDescription
        if (typeof d !== 'string') continue
        seen += 1
        assert.ok(
          re.test(d),
          `${logicalId} (${type}) has a description AWS will reject: ${why}. ` +
            `Offending characters: ${JSON.stringify([...d].filter((c) => !re.test(c)))}`,
        )
      }
    }
  }
  assert.ok(seen > 0, 'no description was checked; this assertion read nothing')
})

/**
 * 🛑 NO BACKTICK MAY APPEAR INSIDE A BUILDSPEC TEMPLATE LITERAL, AND THIS COST
 * THREE SEPARATE `tsc` FAILURES IN ONE FILE BEFORE IT BECAME A TEST.
 *
 * `infra/lib/buildspecs.ts` holds its buildspecs as TEMPLATE LITERALS — the
 * form was chosen on purpose, because only text can carry the comments that
 * reach the person editing a buildspec in the CodeBuild console. This record's
 * house style quotes identifiers in backticks, and a backtick inside a template
 * literal ENDS IT. The result is a cascade of `TS1005: ',' expected` pointing
 * at a line that looks like ordinary prose.
 *
 * It happened writing the G262 scan gate, again writing the IMAGE_TAG
 * correction, and again writing the idempotent push. Three times is a property
 * of the file, not three mistakes.
 *
 * ⚠️ The fix is NOT to stop commenting. The comments are why the text form was
 * chosen. The fix is to spell identifiers without backticks inside these
 * literals — and to find out here, in a second, rather than from a compiler
 * error that names the wrong thing.
 */
test('test_no_buildspec_template_literal_contains_a_backtick', () => {
  const source = readFileSync(join(INFRA_DIR, 'lib', 'buildspecs.ts'), 'utf8')
  const literals = [...source.matchAll(/BUILDSPEC_YAML = `([\s\S]*?)\n`/g)]
  assert.ok(literals.length > 0, 'no buildspec template literal found; this read nothing')
  for (const [, body] of literals) {
    const line = body.split('\n').find((l) => l.includes('`'))
    assert.equal(
      line,
      undefined,
      'a buildspec template literal contains a backtick, which ENDS the literal ' +
        'and produces TS1005 errors pointing at innocent-looking prose. Spell ' +
        `identifiers without backticks in these strings. Offending line: ${JSON.stringify(line)}`,
    )
  }
})
