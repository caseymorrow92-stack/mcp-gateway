import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * RESPONSE REDACTOR
 *
 * Applies response-side redaction based on policy outcome and configured rules.
 * Invariants:
 * - responsePayload is always an object
 * - redactionEvents sorted by locationPath/ruleId
 * - containsSensitiveData is true only when unredacted sensitive markers remain
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "response-redactor",
  inputs: ["PolicyEvaluationV1", "UpstreamExecutionResultV1"],
  outputs: ["RedactedResponseV1"],
  deterministic: true
};
