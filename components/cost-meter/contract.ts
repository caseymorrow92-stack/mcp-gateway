import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * COST METER
 *
 * Calculates request and token costs using provided pricing and usage estimates.
 * Invariants:
 * - lineItems sorted by category then dimensionKey
 * - totals are rounded with contract numeric policy
 * - costRecordId is deterministic from invocationId and line-item materialized values
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "cost-meter",
  inputs: ["NormalizedProxyContextV1", "UpstreamExecutionResultV1", "RedactedResponseV1"],
  outputs: ["CostMeteringRecordV1"],
  deterministic: true
};
