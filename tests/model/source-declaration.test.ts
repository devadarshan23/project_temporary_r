/**
 * C9's declaration, state and pair rules — `model/connectors.ts` §2–§4.
 * G2681–G2690, 1 Oct 2026.
 *
 * Pure. The served half, over a real PostgreSQL, is
 * `tests/http/sources-served.test.ts`.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SOURCE_CONNECTION_CHANNEL,
  SOURCE_CONNECTION_KINDS,
  checkSourcePair,
  sourceState,
  validateSourceConnection,
  validateSourceDeclaration,
  type SftpConnection,
  type S3Connection,
  type SourceDeclarationRefusal,
} from '../../model/connectors.ts'
import { CHANNEL_DRAWS_THROUGH_AN_ENDPOINT } from '../../model/ingestion.ts'

const PIN = `SHA256:${'A'.repeat(43)}`
const SFTP: SftpConnection = {
  kind: 'sftp',
  host: 'sftp.acme-supplier.example',
  port: 22,
  path: '/outbound/invoices',
  hostKeyFingerprint: PIN,
}
const S3: S3Connection = {
  kind: 's3',
  bucket: 'acme-ap-exports',
  keyPrefix: 'invoices/',
  region: 'ap-southeast-1',
  roleArn: 'arn:aws:iam::123456789012:role/reconcile-read',
}

const refusalOf = (c: SftpConnection | S3Connection): string | undefined =>
  validateSourceConnection(c)?.kind

describe('§1 · a declaration is refused BY NAME, never coerced', () => {
  it('a well-formed SFTP and a well-formed S3 declaration pass', () => {
    assert.equal(validateSourceDeclaration('Supplier SFTP', SFTP), null)
    assert.equal(validateSourceDeclaration('AP exports', S3), null)
  })

  it('the label is the caller’s and must say something', () => {
    assert.equal(validateSourceDeclaration('   ', SFTP)?.kind, 'label_empty')
    assert.equal(validateSourceDeclaration('x'.repeat(201), SFTP)?.kind, 'label_too_long')
  })

  /**
   * 🛑 G2686 — THE SSRF HALF THAT CAN BE CHECKED AT DECLARATION. Each of these
   * would point a future connector at OUR network. The witnessed red for this
   * block: `ipv4IsReserved()` returning `false` unconditionally turns every
   * reserved-address row below into `null`.
   */
  it('a loopback, private, link-local, CGNAT, multicast or IPv6 literal host is refused', () => {
    for (const host of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.4.4',
      '172.31.255.255',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '198.18.0.1',
      '::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      'localhost',
      'metadata.google.internal',
      'printer.local',
    ]) {
      assert.equal(refusalOf({ ...SFTP, host }), 'sftp_host_is_reserved', host)
    }
  })

  it('a public literal is not refused, and the neighbours of each reserved range are public', () => {
    for (const host of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '100.63.255.255', '192.169.0.1']) {
      assert.equal(refusalOf({ ...SFTP, host }), undefined, host)
    }
  })

  it('a host that is not a host name is refused, and is not mistaken for a reserved one', () => {
    for (const host of ['', 'bad_host.example', '-lead.example', 'a..b', '300.1.1.1', 'x'.repeat(254)]) {
      assert.equal(refusalOf({ ...SFTP, host }), 'sftp_host_not_a_hostname', JSON.stringify(host))
    }
  })

  it('the port, the path and the pinned key', () => {
    assert.equal(refusalOf({ ...SFTP, port: 0 }), 'sftp_port_out_of_range')
    assert.equal(refusalOf({ ...SFTP, port: 65536 }), 'sftp_port_out_of_range')
    assert.equal(refusalOf({ ...SFTP, port: 22.5 }), 'sftp_port_out_of_range')
    assert.equal(refusalOf({ ...SFTP, path: 'relative/dir' }), 'sftp_path_not_absolute')
    assert.equal(refusalOf({ ...SFTP, path: '/a/../../etc' }), 'sftp_path_traverses')
    assert.equal(refusalOf({ ...SFTP, path: '/a/./b' }), 'sftp_path_traverses')
    /* Trust-on-first-use is refused: there is no "accept whatever it offers". */
    assert.equal(refusalOf({ ...SFTP, hostKeyFingerprint: '' }), 'sftp_host_key_not_pinned')
    assert.equal(
      refusalOf({ ...SFTP, hostKeyFingerprint: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA' }),
      'sftp_host_key_not_pinned',
    )
    assert.equal(refusalOf({ ...SFTP, hostKeyFingerprint: `MD5:${'a'.repeat(32)}` }), 'sftp_host_key_not_pinned')
  })

  it('the bucket, the prefix, the region and the role', () => {
    for (const bucket of ['ab', 'Upper-Case', 'a..b', '192.168.1.1', 'xn--punycode', 'thing-s3alias', '-dash']) {
      assert.equal(refusalOf({ ...S3, bucket }), 's3_bucket_name_invalid', bucket)
    }
    assert.equal(refusalOf({ ...S3, keyPrefix: '' }), undefined, 'an empty prefix is the whole bucket')
    assert.equal(refusalOf({ ...S3, keyPrefix: '/leading' }), 's3_key_prefix_invalid')
    assert.equal(refusalOf({ ...S3, keyPrefix: 'a/../b' }), 's3_key_prefix_invalid')
    assert.equal(refusalOf({ ...S3, region: 'mars-1' }), 's3_region_invalid')
    assert.equal(refusalOf({ ...S3, region: 'us-gov-west-1' }), undefined)
    for (const roleArn of [
      'arn:aws:iam::123:role/x',
      'arn:aws:iam::123456789012:user/x',
      'arn:aws-cn:iam::123456789012:role/x',
      '*',
    ]) {
      assert.equal(refusalOf({ ...S3, roleArn }), 's3_role_arn_invalid', roleArn)
    }
  })

  /**
   * 🛑 G2685 — THE DECLARATION HAS NO EXTERNAL ID, BY TYPE. A caller who could
   * supply one could copy another tenant's. The type error IS the assertion;
   * the served suite proves the wire refuses one too.
   */
  it('the S3 declaration cannot carry an external id', () => {
    // @ts-expect-error `externalId` is minted by the data plane and is not declarable.
    const smuggled: S3Connection = { ...S3, externalId: 'ext_00000000000000000000000000000000' }
    assert.ok(smuggled !== undefined)
  })

  it('every refusal is a kind and nothing else', () => {
    const r: SourceDeclarationRefusal | null = validateSourceConnection({ ...SFTP, host: '10.0.0.1' })
    assert.deepEqual(r, { kind: 'sftp_host_is_reserved' })
  })
})

describe('§2 · the lane a source draws down is a total answer', () => {
  it('every connection kind names a lane, and that lane draws through an endpoint', () => {
    for (const kind of Object.values(SOURCE_CONNECTION_KINDS)) {
      const lane = SOURCE_CONNECTION_CHANNEL[kind]
      assert.equal(lane, 'watched_drop', kind)
      assert.equal(
        CHANNEL_DRAWS_THROUGH_AN_ENDPOINT[lane],
        true,
        'a source lane that draws through no endpoint would admit unattributable artefacts',
      )
    }
  })
})

describe('§3 · row 24 — the state is derived, in one order', () => {
  it('stopped wins over everything, then the handoff order', () => {
    assert.equal(sourceState({ enabled: false, credentialBound: true, hasArrived: true }), 'stopped')
    assert.equal(sourceState({ enabled: false, credentialBound: false, hasArrived: false }), 'stopped')
    assert.equal(sourceState({ enabled: true, credentialBound: false, hasArrived: false }), 'waiting_on_credential')
    assert.equal(sourceState({ enabled: true, credentialBound: true, hasArrived: false }), 'waiting_on_first_delivery')
    assert.equal(sourceState({ enabled: true, credentialBound: true, hasArrived: true }), 'delivered')
  })

  /**
   * ⚠️ A DELIVERY WITH NO BOUND CREDENTIAL STILL READS "WAITING ON A
   * CREDENTIAL". That is not a contradiction to paper over: the credential
   * is the next act a person owes, and *"the product learns it is done by the
   * source delivering"* is about the HANDOFF — which a bind ends under G2401.
   */
  it('an arrival does not skip the credential', () => {
    assert.equal(sourceState({ enabled: true, credentialBound: false, hasArrived: true }), 'waiting_on_credential')
  })
})

describe('§4 · rows 6 and 14 — the pair and its mapping', () => {
  const DECLARED = ['k7:invoice/k5:total/', 'k7:invoice/k6:number/']
  const FULL = [
    { sourceField: 'Amount', fieldPathKey: 'k7:invoice/k5:total/' },
    { sourceField: 'Invoice No', fieldPathKey: 'k7:invoice/k6:number/' },
  ]

  it('a complete mapping onto declared fields passes', () => {
    assert.equal(checkSourcePair({ kind: 'path_prefix', value: 'invoices/' }, DECLARED, FULL), null)
    assert.equal(checkSourcePair({ kind: 'filename', value: 'ledger.csv' }, DECLARED, FULL), null)
  })

  /** Row 14's own refusal, carrying a COUNT and never a field name. */
  it('an incomplete mapping refuses the declaration', () => {
    assert.deepEqual(checkSourcePair({ kind: 'filename', value: 'x.csv' }, DECLARED, FULL.slice(0, 1)), {
      kind: 'mapping_incomplete',
      unmapped: 1,
    })
    assert.deepEqual(checkSourcePair({ kind: 'filename', value: 'x.csv' }, DECLARED, []), {
      kind: 'mapping_incomplete',
      unmapped: 2,
    })
  })

  it('a mapping cannot declare a field, repeat one, or reuse a source column', () => {
    const at = (m: typeof FULL) => checkSourcePair({ kind: 'filename', value: 'x.csv' }, DECLARED, m)?.kind
    assert.equal(at([...FULL, { sourceField: 'Extra', fieldPathKey: 'k5:bogus/' }]), 'mapping_names_an_undeclared_field')
    assert.equal(at([FULL[0]!, { sourceField: 'Again', fieldPathKey: 'k7:invoice/k5:total/' }]), 'mapping_repeats_a_type_field')
    assert.equal(at([FULL[0]!, { sourceField: 'Amount', fieldPathKey: 'k7:invoice/k6:number/' }]), 'mapping_repeats_a_source_field')
    assert.equal(at([{ sourceField: 'tab\there', fieldPathKey: 'k7:invoice/k5:total/' }]), 'source_field_invalid')
  })

  it('a type that declares no field cannot be paired', () => {
    assert.equal(checkSourcePair({ kind: 'filename', value: 'x.csv' }, [], [])?.kind, 'document_type_declares_no_fields')
  })

  it('the pattern is a literal: no traversal, no absolute prefix, no path in a filename', () => {
    for (const match of [
      { kind: 'filename' as const, value: 'a/b.csv' },
      { kind: 'filename' as const, value: '..' },
      { kind: 'filename' as const, value: '' },
      { kind: 'path_prefix' as const, value: '/abs/' },
      { kind: 'path_prefix' as const, value: 'a/../b' },
      { kind: 'path_prefix' as const, value: 'nul\u0000byte' },
    ]) {
      assert.equal(checkSourcePair(match, DECLARED, FULL)?.kind, 'match_value_invalid', JSON.stringify(match))
    }
  })
})
