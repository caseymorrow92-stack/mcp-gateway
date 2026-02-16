import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * UPSTREAM DISPATCHER
 *
 * Produces a deterministic dispatch result from pre-dispatch middleware decisions.
 * Invariants:
 * - dispatch is blocked when auth/policy/rate-limit/request-redaction deny
 * - no external network calls are performed in this component
 * - blocked outcomes set blockedByStage and dispatched=false
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "upstream-dispatcher",
  inputs: ["NormalizedProxyContextV1", "AuthEvaluationV1", "PolicyEvaluationV1", "RateLimitDecisionV1", "RedactedRequestV1"],
  outputs: ["UpstreamExecutionResultV1"],
  deterministic: true
};
