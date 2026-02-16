import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * TRACE RECORDER
 *
 * Emits deterministic middleware/upstream spans and scalar metrics for OTel export.
 * Invariants:
 * - span ids derive from traceId, span metadata, and ordinal
 * - spans sorted by spanKind then spanName
 * - metric keys are stable and deterministic for identical input
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "trace-recorder",
  inputs: [
    "NormalizedProxyContextV1",
    "AuthEvaluationV1",
    "PolicyEvaluationV1",
    "RateLimitDecisionV1",
    "UpstreamExecutionResultV1",
    "RedactedResponseV1"
  ],
  outputs: ["TraceRecordSetV1"],
  deterministic: true
};
