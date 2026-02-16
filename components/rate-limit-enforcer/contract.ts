import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * RATE LIMIT ENFORCER
 *
 * Applies fixed-window per-dimension limits using provided historical counters.
 * Invariants:
 * - appliedRules sorted by dimension/windowSeconds/limit
 * - allowed=false when any rule exceeds limit
 * - retryAfterSeconds computed from input windowStartEpochMs and windowSeconds
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "rate-limit-enforcer",
  inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1"],
  outputs: ["RateLimitDecisionV1"],
  deterministic: true
};
