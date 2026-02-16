import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * PROXY PROCESS GOVERNOR
 *
 * Deterministically validates a stdio child-process launch request before spawn.
 * Invariants:
 * - commands are allowlisted by first token/prefix
 * - restart and timeout policy are clamped into deterministic bounds
 * - decision id is derived from canonical request and decision outcome
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "proxy-process-governor",
  inputs: ["ProxyProcessSpawnRequestV1"],
  outputs: ["ProxyProcessSpawnDecisionV1"],
  deterministic: true
};
