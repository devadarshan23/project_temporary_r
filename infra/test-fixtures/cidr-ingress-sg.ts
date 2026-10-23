/**
 * THE SECOND RED WITNESS, AND IT DIFFERS FROM `cross-plane-sg.ts` IN ONE THING.
 *
 * That fixture admits the control plane BY GROUP. This one admits the whole
 * private address range BY CIDR — `10.40.0.0/16`, the VPC's own block — which
 * is the likelier mistake of the two, because it looks like tightening (a
 * private range! not the internet!) and is in fact the opposite: a CIDR rule
 * admits whatever lands in that range NEXT, including every control-plane task.
 *
 * The two fixtures exist separately because the assertion they trip is
 * different: one resolves a source group back to its `Plane` tag, the other
 * refuses CIDR sources on a database group outright. A single fixture carrying
 * both mistakes would let either arm of the control rot unnoticed while the
 * test stayed red for the other reason.
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2'

import { buildApp } from '../lib/app.ts'
import { STACK_NETWORK_STAGING } from '../lib/config.ts'
import { NetworkStack, POSTGRES_PORT } from '../lib/network-stack.ts'

const app = buildApp()
const network = app.node.findChild(STACK_NETWORK_STAGING) as NetworkStack

// The one difference from the real app.
network.dataPlaneDbSg.addIngressRule(
  ec2.Peer.ipv4('10.40.0.0/16'),
  ec2.Port.tcp(POSTGRES_PORT),
  'ANYTHING IN THE VPC. This fixture exists so that writing it is red.',
)

const assembly = app.synth()

const templates: Record<string, unknown> = {}
for (const artefact of assembly.stacks) {
  templates[artefact.stackName] = artefact.template
}

process.stdout.write(JSON.stringify(templates))
