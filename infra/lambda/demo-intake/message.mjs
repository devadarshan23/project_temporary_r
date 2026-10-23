/**
 * The one shape a lead has on the intake queue — G3681, 3 Oct 2026.
 *
 * ⚠️ ITS OWN FILE SO THAT `index.mjs` AND `worker.mjs` SHARE IT WITHOUT THE
 * PUBLIC FUNCTION IMPORTING THE WORKER. `tests/infra/demo-intake.test.mjs`
 * §10 refuses any import of `worker.mjs` from `index.mjs`, and a constant the
 * two must agree on would otherwise have pulled the CRM code into the request
 * path's import graph.
 */

/** The `source` every queued lead carries, and what the CRM is told it came from. */
export const INTAKE_MESSAGE_SOURCE = 'reconcileai.app/demo'

/**
 * The message body for one validated lead.
 *
 * @param {Record<string, string>} intake
 * @returns {string}
 */
export function intakeMessage(intake) {
  return JSON.stringify({ source: INTAKE_MESSAGE_SOURCE, lead: intake })
}
