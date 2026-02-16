import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * REQUEST REDACTOR
 *
 * Applies deterministic redaction rules to outgoing MCP tool arguments.
 * Invariants:
 * - rule application order is ruleId asc then matchPath asc
 * - redactionEvents sorted by locationPath/ruleId
 * - output status is deny when selected tool is blocked by tool filter
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "request-redactor",
  inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1", "ToolFilterDecisionV1"],
  outputs: ["RedactedRequestV1"],
  deterministic: true
};
