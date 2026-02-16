import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * EXCHANGE ASSEMBLER
 *
 * Consolidates all middleware decisions into the final execution report artifact.
 * Invariants:
 * - middlewareDecisions sorted by stage then status
 * - finalStatus is blocked when any gating stage denies dispatch
 * - executionReportId is derived from deterministic upstream artifacts
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "exchange-assembler",
  inputs: [
    "NormalizedProxyContextV1",
    "AuthEvaluationV1",
    "PolicyEvaluationV1",
    "ToolFilterDecisionV1",
    "RateLimitDecisionV1",
    "RedactedRequestV1",
    "UpstreamExecutionResultV1",
    "RedactedResponseV1",
    "TraceRecordSetV1",
    "CostMeteringRecordV1"
  ],
  outputs: ["MiddlewareExecutionReportV1"],
  deterministic: true
};
