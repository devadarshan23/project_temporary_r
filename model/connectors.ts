/** Connector configuration: closed over security-relevant kinds, open over names. */
import type { Capability } from './access'
import type { AssertNoTextDeep } from './reconciliation'

export const CONNECTOR_PARAMETER_KINDS = {
  tlsVerification: 'tls_verification',
  hostBinding: 'host_binding',
  credentialRef: 'credential_ref',
  descriptive: 'descriptive',
} as const

export type ConnectorParameterKind =
  (typeof CONNECTOR_PARAMETER_KINDS)[keyof typeof CONNECTOR_PARAMETER_KINDS]

export interface ConnectorParameterEnforcement {
  readonly settableBy: Capability
  readonly clearsVerification: boolean
  readonly mayCarryDeclaredValue: boolean
}

/** Total by construction: a new kind cannot be added without an enforcement row. */
export const CONNECTOR_PARAMETER_ENFORCEMENT: Record<
  ConnectorParameterKind,
  ConnectorParameterEnforcement
> = {
  tls_verification: { settableBy: 'configure_endpoint', clearsVerification: true, mayCarryDeclaredValue: true },
  host_binding: { settableBy: 'configure_endpoint', clearsVerification: true, mayCarryDeclaredValue: false },
  credential_ref: { settableBy: 'bind_secret', clearsVerification: true, mayCarryDeclaredValue: false },
  descriptive: { settableBy: 'configure_endpoint', clearsVerification: false, mayCarryDeclaredValue: true },
}

export interface ConnectorParameter {
  readonly name: string
  readonly kind: ConnectorParameterKind
  readonly declaredValue: string | null
  readonly secret: boolean
  readonly insecureValues: readonly string[]
}

export interface ConnectorParameterSet {
  readonly declaredBy: string
  readonly parameters: readonly ConnectorParameter[]
}

export type ConnectorParameterViolationRule =
  | 'parameter_kind_missing'
  | 'parameter_kind_unknown'
  | 'declared_value_on_kind_that_may_not_carry_one'
  | 'parameter_holds_key_material'
  | 'multiple_credential_ref_parameters'
  | 'duplicate_parameter_name'
  | 'tls_parameter_names_no_insecure_value'
  | 'insecure_values_on_non_tls_parameter'
  | 'tls_parameter_declares_an_insecure_default'

export interface ConnectorParameterViolation {
  readonly rule: ConnectorParameterViolationRule
  readonly parameterName: string
  readonly detail: string
}

const KNOWN_KINDS = new Set<string>(Object.values(CONNECTOR_PARAMETER_KINDS))

/** Runtime half of default-deny: manifests may arrive after TypeScript has erased. */
export function validateConnectorParameters(set: ConnectorParameterSet): ConnectorParameterViolation[] {
  const violations: ConnectorParameterViolation[] = []
  const names = new Set<string>()
  let credentialRefs = 0
  for (const parameter of set.parameters) {
    const parameterName = parameter.name
    const add = (rule: ConnectorParameterViolationRule, detail: string) =>
      violations.push({ rule, parameterName, detail })
    if (names.has(parameterName)) add('duplicate_parameter_name', 'Parameter names must be unique within a connector.')
    names.add(parameterName)
    const kind: unknown = parameter.kind
    if (kind === undefined || kind === null || kind === '') {
      add('parameter_kind_missing', 'Every connector parameter carries a kind. `descriptive` is explicit, not absence.')
      continue
    }
    if (typeof kind !== 'string' || !KNOWN_KINDS.has(kind)) {
      add('parameter_kind_unknown', 'Connector parameter kind is not published by the platform.')
      continue
    }
    const enforcement = CONNECTOR_PARAMETER_ENFORCEMENT[kind as ConnectorParameterKind]
    if (parameter.secret) add('parameter_holds_key_material', 'No connector parameter may hold key material.')
    if (!enforcement.mayCarryDeclaredValue && parameter.declaredValue !== null) {
      add('declared_value_on_kind_that_may_not_carry_one', 'This kind may not carry a declared value.')
    }
    if (kind === CONNECTOR_PARAMETER_KINDS.tlsVerification) {
      if (parameter.insecureValues.length === 0) add('tls_parameter_names_no_insecure_value', 'TLS parameters must name the values that disable verification.')
      if (parameter.declaredValue !== null && parameter.insecureValues.includes(parameter.declaredValue)) add('tls_parameter_declares_an_insecure_default', 'A connector may not declare verification disabled by default.')
    } else if (parameter.insecureValues.length > 0) {
      add('insecure_values_on_non_tls_parameter', 'Only tls_verification parameters may name insecure values.')
    }
    if (kind === CONNECTOR_PARAMETER_KINDS.credentialRef) credentialRefs += 1
  }
  if (credentialRefs > 1) violations.push({ rule: 'multiple_credential_ref_parameters', parameterName: 'credential_ref', detail: 'An Endpoint has one credentialRef, so a connector may declare at most one.' })
  return violations
}

/* ==================================================================== *
 * §2  DECLARING A SOURCE — C9 rows 1 and 3, the SFTP and S3 halves.
 *     G2681–G2690, 1 Oct 2026. DERIVED, NOT THE OWNER'S.
 * ==================================================================== *
 *
 * 🛑 TWO KINDS AND NOT FOUR, AND THE TWO ABSENT ARE ABSENT BY RULING RATHER
 *    THAN BY EFFORT. The pack's row 3 names four — SFTP, S3, email and SAP —
 *    and R16 (1 Oct 2026, the owner's) moved *"SAP is oData, and read-only"*
 *    and *"Email is forwarded, not read"* to `refused`. Email additionally
 *    needs an inbound mail domain we operate; SAP needs request-path egress
 *    (G2151) and a connector runtime. A member nothing can produce a lane for
 *    is a promise rather than a vocabulary, so neither is here.
 *
 * ⚠️ NOTHING HERE CONNECTS TO ANYTHING. A declaration is CONFIGURATION: a host
 *    and a pinned key, or a bucket and a role. Whether the host answers is
 *    row 2 (*"Test before declare"*), blocked on the same egress question, so
 *    a declaration is a statement of WHERE and never a claim that it works.
 * -------------------------------------------------------------------- */

/** The connection kinds a source may be declared with. CLOSED. */
export const SOURCE_CONNECTION_KINDS = {
  sftp: 'sftp',
  s3: 's3',
} as const
export type SourceConnectionKind =
  (typeof SOURCE_CONNECTION_KINDS)[keyof typeof SOURCE_CONNECTION_KINDS]

/**
 * Which intake lane a declared source draws down, as a TOTAL record — so a
 * third connection kind is a compile error here and its author must answer
 * which of G184's four lanes it is.
 *
 * Both are `watched_drop`: the customer drops a file into a location they own
 * and we watch it. `connector_pull` is the lane for pulling from a system of
 * record (an ERP's API), which is SAP's and is refused by R16. Reading `s3` as
 * a `connector_pull` would make a bucket of exported files look like a live
 * integration — the lossy projection G184 refused, in the other direction.
 */
export const SOURCE_CONNECTION_CHANNEL: Record<SourceConnectionKind, 'watched_drop'> = {
  sftp: 'watched_drop',
  s3: 'watched_drop',
}

/** An SFTP drop. Every field is the customer's and is DECLARED, never sniffed. */
export interface SftpConnection {
  readonly kind: 'sftp'
  readonly host: string
  readonly port: number
  /** Absolute. The directory we watch. */
  readonly path: string
  /**
   * The PINNED host key, as OpenSSH prints it: `SHA256:` and 43 base64
   * characters. Required, because trust-on-first-use is the one way to accept
   * an attacker's key without anybody being asked.
   */
  readonly hostKeyFingerprint: string
}

/**
 * An S3 drop in the customer's account, reached by ASSUMING A ROLE THEY OWN.
 *
 * ⚠️ THERE IS NO `externalId` FIELD AND THAT IS THE CONTROL. The external id
 * is minted by US at declaration and published back for their trust policy;
 * a caller who could choose it could copy another tenant's, name that
 * tenant's role, and pass the trust condition — the confused deputy the
 * external id exists to defeat. So the declaration cannot carry one.
 */
export interface S3Connection {
  readonly kind: 's3'
  readonly bucket: string
  /** May be empty — the whole bucket. Never a leading `/`. */
  readonly keyPrefix: string
  readonly region: string
  readonly roleArn: string
}

export type SourceConnection = SftpConnection | S3Connection

/**
 * Every way a declaration can be refused. Carries the KIND and nothing else —
 * the values are the caller's own input and a refusal is the thing most likely
 * to reach a log line.
 */
export type SourceDeclarationRefusal =
  | { readonly kind: 'label_empty' }
  | { readonly kind: 'label_too_long' }
  | { readonly kind: 'sftp_host_not_a_hostname' }
  /**
   * 🛑 A LOOPBACK, PRIVATE, LINK-LOCAL OR OTHERWISE RESERVED ADDRESS — and the
   * reserved names that resolve to one. A source naming `169.254.169.254` or
   * `10.0.0.5` would, the day a connector exists, point OUR pull at OUR
   * network. Refused at declaration because that is the cheapest place. It is
   * NOT the whole control: a public NAME may RESOLVE to a reserved address,
   * and only the connector at connect time can see that (G2686).
   */
  | { readonly kind: 'sftp_host_is_reserved' }
  | { readonly kind: 'sftp_port_out_of_range' }
  | { readonly kind: 'sftp_path_not_absolute' }
  | { readonly kind: 'sftp_path_traverses' }
  | { readonly kind: 'sftp_host_key_not_pinned' }
  | { readonly kind: 's3_bucket_name_invalid' }
  | { readonly kind: 's3_key_prefix_invalid' }
  | { readonly kind: 's3_region_invalid' }
  | { readonly kind: 's3_role_arn_invalid' }

export type _SourceDeclarationRefusalHoldsNoText = AssertNoTextDeep<SourceDeclarationRefusal>

const LABEL_MAX = 200
/* ⚠️ ONE PATTERN OVER THE WHOLE NAME AND NOT A SPLIT ON A DOT — `tests/model/
 * field-path-addresses-a-payload.test.ts` refuses a module that splits a
 * string on `.` or `/` beside `parseFieldPath()`, and it caught this file's
 * first draft doing both. A host name is not a field path; the cheaper answer
 * than an exemption is not to split at all. */
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
const TRAVERSING_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const SHA256_FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/
const S3_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const AWS_REGION = /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/
const IAM_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/
const RESERVED_NAME_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'] as const

/**
 * Whether an IPv4 literal is in a range a source may never name: 0/8, 10/8,
 * 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15,
 * and everything from 224/4 up (multicast, 240/4 and the broadcast address).
 */
function ipv4IsReserved(a: number, b: number, c: number): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 0 && c === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  return false
}

function checkSftpHost(raw: string): SourceDeclarationRefusal | null {
  const host = raw.toLowerCase()
  if (host.length === 0 || host.length > 253) return { kind: 'sftp_host_not_a_hostname' }
  /* ⚠️ AN IPv6 LITERAL IS REFUSED OUTRIGHT, NOT RANGE-CHECKED. Its reserved
   * space (`::1`, `fe80::/10`, `fc00::/7`, v4-mapped `::ffff:a.b.c.d`) has
   * several spellings for one address, and a partial check is worse than
   * none because it reads as a whole one. */
  if (host.includes(':')) return { kind: 'sftp_host_is_reserved' }
  const v4 = IPV4.exec(host)
  if (v4 !== null) {
    const octets = v4.slice(1).map((o) => Number(o))
    if (octets.some((o) => o > 255)) return { kind: 'sftp_host_not_a_hostname' }
    const [a = 0, b = 0, c = 0] = octets
    return ipv4IsReserved(a, b, c) ? { kind: 'sftp_host_is_reserved' } : null
  }
  if (host === 'localhost' || RESERVED_NAME_SUFFIXES.some((s) => host.endsWith(s))) {
    return { kind: 'sftp_host_is_reserved' }
  }
  if (!HOSTNAME.test(host)) {
    return { kind: 'sftp_host_not_a_hostname' }
  }
  return null
}

function pathTraverses(path: string): boolean {
  return TRAVERSING_SEGMENT.test(path)
}

/** Total; pure; returns the FIRST refusal in declaration order, or `null`. */
export function validateSourceConnection(
  connection: SourceConnection,
): SourceDeclarationRefusal | null {
  switch (connection.kind) {
    case 'sftp': {
      const host = checkSftpHost(connection.host)
      if (host !== null) return host
      if (!Number.isInteger(connection.port) || connection.port < 1 || connection.port > 65535) {
        return { kind: 'sftp_port_out_of_range' }
      }
      if (!connection.path.startsWith('/') || hasControlCharacter(connection.path)) {
        return { kind: 'sftp_path_not_absolute' }
      }
      if (pathTraverses(connection.path)) return { kind: 'sftp_path_traverses' }
      if (!SHA256_FINGERPRINT.test(connection.hostKeyFingerprint)) {
        return { kind: 'sftp_host_key_not_pinned' }
      }
      return null
    }
    case 's3': {
      const bucket = connection.bucket
      if (
        !S3_BUCKET.test(bucket) ||
        bucket.includes('..') ||
        IPV4.test(bucket) ||
        bucket.startsWith('xn--') ||
        bucket.endsWith('-s3alias')
      ) {
        return { kind: 's3_bucket_name_invalid' }
      }
      const prefix = connection.keyPrefix
      if (
        prefix.length > 1024 ||
        prefix.startsWith('/') ||
        hasControlCharacter(prefix) ||
        pathTraverses(prefix)
      ) {
        return { kind: 's3_key_prefix_invalid' }
      }
      if (!AWS_REGION.test(connection.region)) return { kind: 's3_region_invalid' }
      if (!IAM_ROLE_ARN.test(connection.roleArn)) return { kind: 's3_role_arn_invalid' }
      return null
    }
  }
}

/** The label first, then the connection. */
export function validateSourceDeclaration(
  label: string,
  connection: SourceConnection,
): SourceDeclarationRefusal | null {
  if (label.trim().length === 0) return { kind: 'label_empty' }
  if (label.length > LABEL_MAX) return { kind: 'label_too_long' }
  return validateSourceConnection(connection)
}

/* ==================================================================== *
 * §3  WHAT A DECLARED SOURCE IS DOING — C9 row 24. DERIVED, NEVER STORED.
 * ==================================================================== *
 *
 * The pack: *"A declared source reads waiting on a credential and stays
 * there; the product learns it is done by the source delivering, not by being
 * told."* So there is NO state column anywhere: three facts the tree already
 * holds are read, and this function is the one place their order lives.
 *
 * ⚠️ `waiting_on_first_delivery` IS A STATE THE PACK DOES NOT DRAW, AND IT IS
 *    G2401's CONSEQUENCE RATHER THAN AN INVENTION (G2688). In the pack's world
 *    the customer's engineer writes the credential into THEIR Secrets Manager,
 *    so the product cannot tell a bound credential from an absent one. Under
 *    G2401 we hold it, so a bound credential IS observable — and folding it
 *    back into "waiting on a credential" would tell a person who has just
 *    bound one that they have not.
 */
export const SOURCE_STATES = {
  waitingOnCredential: 'waiting_on_credential',
  waitingOnFirstDelivery: 'waiting_on_first_delivery',
  delivered: 'delivered',
  stopped: 'stopped',
} as const
export type SourceState = (typeof SOURCE_STATES)[keyof typeof SOURCE_STATES]

export interface SourceStateFacts {
  /** The lane is live — `intake_channel.enabled`, the switch the cascade reads. */
  readonly enabled: boolean
  readonly credentialBound: boolean
  /** Any `Arrival` row on the source's lane, admitted or refused. */
  readonly hasArrived: boolean
}

/**
 * Stopped wins over everything: a stopped source is stopped whatever it has
 * done. Then the handoff order. A REFUSED arrival still counts as delivered —
 * the source sent something, which is the fact row 24 says ends the wait.
 */
export function sourceState(facts: SourceStateFacts): SourceState {
  if (!facts.enabled) return 'stopped'
  if (!facts.credentialBound) return 'waiting_on_credential'
  if (!facts.hasArrived) return 'waiting_on_first_delivery'
  return 'delivered'
}

/* ==================================================================== *
 * §4  SOURCE × DOCUMENT TYPE, AND THE FIELD MAPPING — C9 rows 6, 11, 14.
 * ==================================================================== *
 *
 * Row 6: *"The type is not a property of the source … The identifier is the
 * pair — this source, and a pattern within it … each pair naming one type."*
 * Row 14: *"per source-and-pattern pair … Required before extraction, so an
 * incomplete mapping refuses the declaration."*
 *
 * 🛑 THE PATTERN IS A LITERAL AND NOTHING IS COMPILED — G130's and G206's
 *    rule, which `validatePackClassificationRules()` states for the pack's
 *    half: it *"never constructs a `RegExp`"*. A customer-typed glob or regex
 *    would be text compiled into a matcher. Two kinds, each a byte
 *    comparison: a path PREFIX and an exact FILENAME. The pack's *subject* and
 *    *sender* are email's, and are refused with email (R16).
 *
 * 🛑 THE MAPPING NEVER WRITES `document_field_spec` (`0012` §5). It maps a
 *    source's own column name ONTO a `FieldSpec` the type already declares;
 *    it cannot declare a field, so it cannot declare a classification
 *    (invariant 4).
 *
 * ⚠️ ROW 11 IS A PROPERTY OF THE PAIR'S SHAPE, NOT OF A FUNCTION: a pair has
 *    no fidelity, so every pair to a type inherits the type's
 *    `expectedFidelity` and cannot override it (G2690).
 */
export const SOURCE_MATCH_KINDS = {
  pathPrefix: 'path_prefix',
  filename: 'filename',
} as const
export type SourceMatchKind = (typeof SOURCE_MATCH_KINDS)[keyof typeof SOURCE_MATCH_KINDS]

export interface SourceMatch {
  readonly kind: SourceMatchKind
  readonly value: string
}

export interface SourceFieldMapping {
  /** What the SOURCE calls it — a column header, a JSON key. */
  readonly sourceField: string
  /** What the TYPE calls it — a declared `FieldSpec`'s stored path key. */
  readonly fieldPathKey: string
}

export type SourcePairRefusal =
  | { readonly kind: 'match_value_invalid' }
  /** The type declares no field, so no mapping can be complete or meaningful. */
  | { readonly kind: 'document_type_declares_no_fields' }
  | { readonly kind: 'source_field_invalid' }
  | { readonly kind: 'mapping_names_an_undeclared_field' }
  | { readonly kind: 'mapping_repeats_a_type_field' }
  | { readonly kind: 'mapping_repeats_a_source_field' }
  /** Row 14's refusal. Carries the COUNT, never the field names. */
  | { readonly kind: 'mapping_incomplete'; readonly unmapped: number }

export type _SourcePairRefusalHoldsNoText = AssertNoTextDeep<SourcePairRefusal>

const MATCH_VALUE_MAX = 255
const SOURCE_FIELD_MAX = 255

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

function checkMatch(match: SourceMatch): SourcePairRefusal | null {
  const v = match.value
  if (v.length === 0 || v.length > MATCH_VALUE_MAX || hasControlCharacter(v)) {
    return { kind: 'match_value_invalid' }
  }
  switch (match.kind) {
    case 'filename':
      return v.includes('/') || v === '.' || v === '..' ? { kind: 'match_value_invalid' } : null
    case 'path_prefix':
      return v.startsWith('/') || pathTraverses(v) ? { kind: 'match_value_invalid' } : null
  }
}

/**
 * Row 14, exactly: every field the type DECLARES must be mapped, and nothing
 * the type does not declare may be. Total; pure; first refusal wins, in the
 * order a person would fix them — the pattern, then the type, then each line,
 * then completeness.
 */
export function checkSourcePair(
  match: SourceMatch,
  declaredPathKeys: readonly string[],
  mappings: readonly SourceFieldMapping[],
): SourcePairRefusal | null {
  const matchRefusal = checkMatch(match)
  if (matchRefusal !== null) return matchRefusal
  if (declaredPathKeys.length === 0) return { kind: 'document_type_declares_no_fields' }
  const declared = new Set(declaredPathKeys)
  const typeFields = new Set<string>()
  const sourceFields = new Set<string>()
  for (const m of mappings) {
    if (
      m.sourceField.length === 0 ||
      m.sourceField.length > SOURCE_FIELD_MAX ||
      hasControlCharacter(m.sourceField)
    ) {
      return { kind: 'source_field_invalid' }
    }
    if (!declared.has(m.fieldPathKey)) return { kind: 'mapping_names_an_undeclared_field' }
    if (typeFields.has(m.fieldPathKey)) return { kind: 'mapping_repeats_a_type_field' }
    if (sourceFields.has(m.sourceField)) return { kind: 'mapping_repeats_a_source_field' }
    typeFields.add(m.fieldPathKey)
    sourceFields.add(m.sourceField)
  }
  const unmapped = declared.size - typeFields.size
  return unmapped > 0 ? { kind: 'mapping_incomplete', unmapped } : null
}
