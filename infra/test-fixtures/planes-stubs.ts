/**
 * STUB `Network` AND `Data` PROPS FOR THE `Planes` STACK.
 *
 * 🛑 WHY A STUB EXISTS AT ALL, SAID BEFORE ANYBODY HAS TO GUESS. The `Network`
 * and `Data` stacks are being written in parallel and are not on this branch.
 * Waiting for them would mean landing `lib/planes-stack.ts` with the credential
 * fence of G253 asserted by nothing — and `docs/HANDOFF.md` §5.6 is that a
 * control which cannot be witnessed failing is a control that asserts nothing.
 * So the fence is witnessed here, green and red, against values that are
 * OBVIOUSLY not real.
 *
 * ⚠️ EVERY VALUE BELOW IS AN IMPORT, NOT A RESOURCE. `fromVpcAttributes`,
 * `fromSecurityGroupId` and `fromSecretCompleteArn` reach no API — they build
 * identifiers from strings — so a fixture synth stays offline and deterministic
 * under G108, and nothing here can ever be deployed by accident: `vpc-0fixture`
 * does not exist.
 *
 * 🛑 THE SECRET ARNS ARE LITERALS AND THAT IS LOAD-BEARING FOR THE TEST. An
 * imported secret's ARN appears VERBATIM in every IAM policy that grants it, so
 * `tests/infra/planes.test.mjs` can ask a flat question of the template — which
 * roles name this string — instead of resolving tokens. A generated secret
 * would put a `Ref` there and the question would become a graph walk.
 */

import { Stack } from 'aws-cdk-lib'
import type { App } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

import { CDK_ENV } from '../lib/config.ts'
import type {
  ControlPlaneDatabase,
  DataPlaneDatabase,
  PlanesNetwork,
} from '../lib/planes-stack.ts'

/**
 * The four credentials, by ARN. The two the services must NEVER reach are the
 * migrator and the two admins.
 */
export const STUB_SECRET_ARNS = {
  dataAdmin:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/admin-AAAAAA',
  dataMigrator:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/migrator-BBBBBB',
  dataApp: 'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/app-CCCCCC',
  /* G3861 — `reconcile_engine`. DISTINCT from `dataApp` for G1282's reason
   * below: the suite tells the run worker's credential from the listener's by
   * this arn, and the serving data plane must never be granted it. */
  dataEngine:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/engine-GGGGGG',
  controlAdmin:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/control/admin-DDDDDD',
  controlApp:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/control/app-EEEEEE',
} as const

/** A stack that holds nothing but imports, so it synthesises to an empty template. */
export function stubScope(app: App): Stack {
  return new Stack(app, 'fixture-planes-stubs', { env: CDK_ENV })
}

export function stubNetwork(scope: Stack): PlanesNetwork {
  const vpc = ec2.Vpc.fromVpcAttributes(scope, 'Vpc', {
    vpcId: 'vpc-0fixture',
    availabilityZones: ['us-west-2a', 'us-west-2b'],
    privateSubnetIds: ['subnet-0fixturea', 'subnet-0fixtureb'],
  })

  return {
    vpc,
    taskSubnets: { subnets: vpc.privateSubnets },
    loadBalancerSubnets: { subnets: vpc.privateSubnets },
    dataPlaneAlbSecurityGroup: ec2.SecurityGroup.fromSecurityGroupId(
      scope,
      'DataAlbSg',
      'sg-0fixturedataalb',
    ),
    controlPlaneAlbSecurityGroup: ec2.SecurityGroup.fromSecurityGroupId(
      scope,
      'ControlAlbSg',
      'sg-0fixturectlalb',
    ),
    dataPlaneSecurityGroup: ec2.SecurityGroup.fromSecurityGroupId(
      scope,
      'DataSg',
      'sg-0fixturedata',
    ),
    controlPlaneSecurityGroup: ec2.SecurityGroup.fromSecurityGroupId(
      scope,
      'ControlSg',
      'sg-0fixturecontrol',
    ),
  }
}

export function stubDataDatabase(scope: Stack): DataPlaneDatabase {
  return {
    host: 'fixture-data.cluster-xxxx.us-west-2.rds.amazonaws.com',
    port: 5432,
    databaseName: 'reconcile_data',
    adminUser: 'reconcile_data_admin',
    adminSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'DataAdminSecret',
        STUB_SECRET_ARNS.dataAdmin,
      ),
      passwordField: 'password',
    },
    migratorSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'DataMigratorSecret',
        STUB_SECRET_ARNS.dataMigrator,
      ),
      passwordField: 'password',
    },
    appSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'DataAppSecret',
        STUB_SECRET_ARNS.dataApp,
      ),
      passwordField: 'password',
    },
    engineSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'DataEngineSecret',
        STUB_SECRET_ARNS.dataEngine,
      ),
      passwordField: 'password',
    },
  }
}

export function stubControlDatabase(scope: Stack): ControlPlaneDatabase {
  return {
    host: 'fixture-control.cluster-yyyy.us-west-2.rds.amazonaws.com',
    port: 5432,
    databaseName: 'reconcile_control',
    adminUser: 'reconcile_control_admin',
    adminSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'ControlAdminSecret',
        STUB_SECRET_ARNS.controlAdmin,
      ),
      passwordField: 'password',
    },
    appSecret: {
      secret: secretsmanager.Secret.fromSecretCompleteArn(
        scope,
        'ControlAppSecret',
        STUB_SECRET_ARNS.controlApp,
      ),
      passwordField: 'password',
    },
  }
}
