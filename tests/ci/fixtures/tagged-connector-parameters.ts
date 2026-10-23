/** Positive control: differs from the negative fixture only by identity and kind. */
export const connectorParameterSets = [
  {
    declaredBy: 'fixture_tagged',
    parameters: [
      {
        name: 'strictHostKeyChecking',
        kind: 'tls_verification',
        declaredValue: 'yes',
        secret: false,
        insecureValues: ['no'],
      },
    ],
  },
]
