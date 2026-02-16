import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * TOOL VISIBILITY FILTER
 *
 * Computes which tools are visible to the principal and whether the selected tool can run.
 * Invariants:
 * - allowedTools sorted by serverId/toolName
 * - blockedTools sorted by reasonCode/serverId/toolName
 * - selectedToolAllowed is false when policy denies or tool visibility blocks selected tool
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "tool-visibility-filter",
  inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1"],
  outputs: ["ToolFilterDecisionV1"],
  deterministic: true
};
