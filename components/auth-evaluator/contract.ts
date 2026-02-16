import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * AUTH EVALUATOR
 *
 * Validates principal identity and required scopes from normalized context.
 * Invariants:
 * - no network introspection or token refresh
 * - effectiveScopes are sorted and deduplicated
 * - deny decision includes concrete failedChecks and reasonCode
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "auth-evaluator",
  inputs: ["NormalizedProxyContextV1"],
  outputs: ["AuthEvaluationV1"],
  deterministic: true
};
