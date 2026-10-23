/** NEGATIVE CONTROL — deliberately untyped so this compiles before the model exists. */
export const connectorParameterSets = [
  {
    declaredBy: 'fixture_untagged',
    parameters: [
      {
        name: 'strictHostKeyChecking',
        declaredValue: 'yes',
        secret: false,
        insecureValues: ['no'],
      },
    ],
  },
]
