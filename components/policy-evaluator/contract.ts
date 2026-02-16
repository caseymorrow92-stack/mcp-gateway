import type { ProgramComponentContract } from "../../../../contracts/program-contract.types";
import type { ArtifactId, ComponentId } from "../../program.contract";

/**
 * POLICY EVALUATOR
 *
 * Applies ordered policy rules to compute allow/deny/transform outcome.
 * Invariants:
 * - rules are evaluated by priority desc then ruleId asc
 * - transform patches are emitted in path asc order
 * - deniedReasonCode is present when status is deny
 */
export const COMPONENT_CONTRACT: ProgramComponentContract<ArtifactId, ComponentId> = {
  id: "policy-evaluator",
  inputs: ["NormalizedProxyContextV1", "AuthEvaluationV1"],
  outputs: ["PolicyEvaluationV1"],
  deterministic: true
};
