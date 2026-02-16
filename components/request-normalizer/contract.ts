import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * REQUEST NORMALIZER
 *
 * Canonicalizes the inbound MCP invocation into a deterministic execution context.
 * Invariants:
 * - invocationId and traceId are derived from input only
 * - scopes and policy/rule arrays are normalized to canonical ordering
 * - request payload is represented as plain object for downstream deterministic access
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "request-normalizer",
  inputs: ["RawProxyInvocationV1"],
  outputs: ["NormalizedProxyContextV1"],
  deterministic: true
};
