import type { AuthEvaluationV1, NormalizedProxyContextV1 } from "../../artifacts";
import { COMPONENT_CONTRACT } from "../contract";

type ContractInputArtifact = Extract<(typeof COMPONENT_CONTRACT.inputs)[number], "NormalizedProxyContextV1">;
type ContractOutputArtifact = Extract<(typeof COMPONENT_CONTRACT.outputs)[number], "AuthEvaluationV1">;

type AuthEvaluatorInput = ContractInputArtifact extends "NormalizedProxyContextV1" ? NormalizedProxyContextV1 : never;
type AuthEvaluatorOutput = ContractOutputArtifact extends "AuthEvaluationV1" ? AuthEvaluationV1 : never;

export type AuthEvaluatorTestVector = {
  name: string;
  input: AuthEvaluatorInput;
  expected: AuthEvaluatorOutput;
};

const BASE_INPUT: NormalizedProxyContextV1 = {
  invocationId: "inv-001",
  traceId: "trace-001",
  normalizedMethod: "tools/call",
  normalizedToolName: "search",
  tenantId: "tenant-123",
  userId: "user-123",
  agentId: "agent-123",
  scopes: ["read:catalog", "write:catalog"],
  requestPayload: { q: "deterministic middleware" },
  requestTokenEstimate: 42,
  responseTokenEstimate: 64,
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: {
    inputTokenPriceUsd: 0.000001,
    outputTokenPriceUsd: 0.000002,
    requestBaseFeeUsd: 0.01
  },
  historicalCallsInWindow: {},
  windowStartEpochMs: 1700000000000
};

export const TEST_VECTORS: AuthEvaluatorTestVector[] = [
  {
    name: "happy-path: allow when principal fields and scopes are present",
    input: BASE_INPUT,
    expected: {
      decisionId: "3f8c6097501d8c3e2d6b51c212405fd841ea478950baaa3dc7a6e380401dac4b",
      authenticated: true,
      status: "allow",
      principal: {
        tenantId: "tenant-123",
        userId: "user-123",
        agentId: "agent-123",
        effectiveScopes: ["read:catalog", "write:catalog"]
      },
      failedChecks: [],
      reasonCode: "auth-ok"
    }
  },
  {
    name: "edge-case: empty scopes with valid identity denies with missing-scopes reason",
    input: {
      ...BASE_INPUT,
      invocationId: "inv-002",
      scopes: []
    },
    expected: {
      decisionId: "383e6041e5bacb14ffc07171280a463832abcfcf556d101ca06cf53a08ee4d90",
      authenticated: false,
      status: "deny",
      principal: {
        tenantId: "tenant-123",
        userId: "user-123",
        agentId: "agent-123",
        effectiveScopes: []
      },
      failedChecks: ["missing-scopes"],
      reasonCode: "auth-missing-scopes"
    }
  },
  {
    name: "edge-case: whitespace-only identity fields treated as empty",
    input: {
      ...BASE_INPUT,
      invocationId: "inv-003",
      tenantId: "   ",
      userId: "\t",
      agentId: "\n"
    },
    expected: {
      decisionId: "0a2aa82ddf31862e742b565904bf28123c629ad56a8315149e2bc1f62ec82287",
      authenticated: false,
      status: "deny",
      principal: {
        tenantId: "",
        userId: "",
        agentId: "",
        effectiveScopes: ["read:catalog", "write:catalog"]
      },
      failedChecks: ["missing-agent", "missing-tenant", "missing-user"],
      reasonCode: "auth-missing-principal"
    }
  },
  {
    name: "empty-minimal: missing identity and scopes produces all failures lexicographically sorted",
    input: {
      ...BASE_INPUT,
      invocationId: "",
      tenantId: "",
      userId: "",
      agentId: "",
      scopes: []
    },
    expected: {
      decisionId: "bd25ebf264602dfbb15164108b1e3502982766c37b9fa6552a79eae3c4017228",
      authenticated: false,
      status: "deny",
      principal: {
        tenantId: "",
        userId: "",
        agentId: "",
        effectiveScopes: []
      },
      failedChecks: ["missing-agent", "missing-scopes", "missing-tenant", "missing-user"],
      reasonCode: "auth-missing-principal"
    }
  }
];
