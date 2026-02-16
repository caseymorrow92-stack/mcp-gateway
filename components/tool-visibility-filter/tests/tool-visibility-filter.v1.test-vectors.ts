import type {
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  ToolFilterDecisionV1
} from "../../artifacts";
import { COMPONENT_CONTRACT } from "../contract";

type ContractInputId = (typeof COMPONENT_CONTRACT.inputs)[number];
type ContractOutputId = (typeof COMPONENT_CONTRACT.outputs)[number];

type ToolVisibilityFilterInput = {
  normalizedContext: "NormalizedProxyContextV1" extends ContractInputId ? NormalizedProxyContextV1 : never;
  policyEvaluation: "PolicyEvaluationV1" extends ContractInputId ? PolicyEvaluationV1 : never;
};

type ToolVisibilityFilterExpected =
  "ToolFilterDecisionV1" extends ContractOutputId ? ToolFilterDecisionV1 : never;

type TestVector = {
  name: string;
  input: ToolVisibilityFilterInput;
  expected: ToolVisibilityFilterExpected;
};

const LONG_DESCRIPTION =
  "Gamma tool description that is intentionally long to verify deterministic truncation at exactly one hundred and twenty characters.....END";

export const TEST_VECTORS: TestVector[] = [
  {
    name: "happy-path-minimal-single-allowed-tool",
    input: {
      normalizedContext: {
        invocationId: "inv-allow-1",
        traceId: "trace-1",
        normalizedMethod: "tools/call",
        normalizedToolName: "listtools",
        tenantId: "tenant-1",
        userId: "user-1",
        agentId: "agent-1",
        scopes: ["tools:read"],
        requestPayload: {
          serverId: "srv-a"
        },
        requestTokenEstimate: 10,
        responseTokenEstimate: 5,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [
          {
            serverId: "srv-a",
            toolName: "ListTools",
            description: "List all tools available to the principal",
            visibility: "public",
            scopeRequirements: []
          }
        ],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.001,
          outputTokenPriceUsd: 0.002,
          requestBaseFeeUsd: 0.01
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-1",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      }
    },
    expected: {
      decisionId: "ca73474eaac4e5f5a542752fc18d9a089b2f12f0bab0143932dd4c756e9589f2",
      status: "allow",
      allowedTools: [
        {
          serverId: "srv-a",
          toolName: "ListTools",
          summarizedDescription: "List all tools available to the principal"
        }
      ],
      blockedTools: [],
      selectedToolAllowed: true
    }
  },
  {
    name: "policy-deny-blocks-all-catalog-tools",
    input: {
      normalizedContext: {
        invocationId: "inv-policy-deny",
        traceId: "trace-2",
        normalizedMethod: "tools/call",
        normalizedToolName: "runjob",
        tenantId: "tenant-1",
        userId: "user-2",
        agentId: "agent-2",
        scopes: ["tools:execute"],
        requestPayload: {
          serverId: "srv-1"
        },
        requestTokenEstimate: 1,
        responseTokenEstimate: 1,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [
          {
            serverId: "srv-2",
            toolName: "BTool",
            description: "B",
            visibility: "private",
            scopeRequirements: []
          },
          {
            serverId: "srv-1",
            toolName: "ATool",
            description: "A",
            visibility: "public",
            scopeRequirements: []
          }
        ],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0,
          outputTokenPriceUsd: 0,
          requestBaseFeeUsd: 0
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-2",
        status: "deny",
        applicableRules: [],
        transformPatches: [],
        deniedReasonCode: "blocked"
      }
    },
    expected: {
      decisionId: "fb1cd1fc70b466bc739a6b2cad0519a07586e107334c4be26aa53bde6ac537fa",
      status: "deny",
      allowedTools: [],
      blockedTools: [
        {
          serverId: "srv-1",
          toolName: "ATool",
          reasonCode: "policy-deny"
        },
        {
          serverId: "srv-2",
          toolName: "BTool",
          reasonCode: "policy-deny"
        }
      ],
      selectedToolAllowed: false
    }
  },
  {
    name: "edge-empty-catalog-deny",
    input: {
      normalizedContext: {
        invocationId: "inv-empty",
        traceId: "trace-3",
        normalizedMethod: "tools/call",
        normalizedToolName: "ghosttool",
        tenantId: "tenant-2",
        userId: "user-3",
        agentId: "agent-3",
        scopes: [],
        requestPayload: {
          serverId: "srv-x"
        },
        requestTokenEstimate: 0,
        responseTokenEstimate: 0,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0,
          outputTokenPriceUsd: 0,
          requestBaseFeeUsd: 0
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-3",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      }
    },
    expected: {
      decisionId: "d54f3d744e0c42b354ae9d7fa71d43b5771874dfdac69799ae5058a455885110",
      status: "deny",
      allowedTools: [],
      blockedTools: [],
      selectedToolAllowed: false
    }
  },
  {
    name: "edge-inconsistent-casing-selected-tool-matches-case-insensitively",
    input: {
      normalizedContext: {
        invocationId: "inv-casing",
        traceId: "trace-4",
        normalizedMethod: "tools/call",
        normalizedToolName: "mixedcase",
        tenantId: "tenant-3",
        userId: "user-4",
        agentId: "agent-4",
        scopes: [],
        requestPayload: {
          serverId: "srv-c"
        },
        requestTokenEstimate: 3,
        responseTokenEstimate: 3,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [
          {
            serverId: "srv-c",
            toolName: "MiXeDCaSe",
            description: "Case test",
            visibility: "public",
            scopeRequirements: []
          }
        ],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0,
          outputTokenPriceUsd: 0,
          requestBaseFeeUsd: 0
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-4",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      }
    },
    expected: {
      decisionId: "296a45f97003762a8390abfaed37e7e8a2ddc32962836933553c1faebfb0a4a9",
      status: "allow",
      allowedTools: [
        {
          serverId: "srv-c",
          toolName: "MiXeDCaSe",
          summarizedDescription: "Case test"
        }
      ],
      blockedTools: [],
      selectedToolAllowed: true
    }
  },
  {
    name: "ordering-and-reason-codes-with-mixed-visibility-and-scope",
    input: {
      normalizedContext: {
        invocationId: "inv-ordering",
        traceId: "trace-5",
        normalizedMethod: "tools/call",
        normalizedToolName: "gamma",
        tenantId: "tenant-4",
        userId: "user-5",
        agentId: "agent-5",
        scopes: ["s:read"],
        requestPayload: {
          serverId: "srv-1"
        },
        requestTokenEstimate: 7,
        responseTokenEstimate: 11,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [
          {
            serverId: "srv-2",
            toolName: "beta",
            description: "Private beta",
            visibility: "private",
            scopeRequirements: []
          },
          {
            serverId: "srv-1",
            toolName: "gamma",
            description: LONG_DESCRIPTION,
            visibility: "restricted",
            scopeRequirements: ["s:read"]
          },
          {
            serverId: "srv-1",
            toolName: "alpha",
            description: "Needs write scope",
            visibility: "public",
            scopeRequirements: ["s:write"]
          },
          {
            serverId: "srv-0",
            toolName: "zeta",
            description: "Public zeta",
            visibility: "public",
            scopeRequirements: []
          }
        ],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0,
          outputTokenPriceUsd: 0,
          requestBaseFeeUsd: 0
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-5",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      }
    },
    expected: {
      decisionId: "e305c66a9b9179e8190aab492bd9346b1c8bea21f9bffc8edd6dcdfa3dbd47f4",
      status: "allow",
      allowedTools: [
        {
          serverId: "srv-0",
          toolName: "zeta",
          summarizedDescription: "Public zeta"
        },
        {
          serverId: "srv-1",
          toolName: "gamma",
          summarizedDescription: LONG_DESCRIPTION.slice(0, 120)
        }
      ],
      blockedTools: [
        {
          serverId: "srv-1",
          toolName: "alpha",
          reasonCode: "missing-scope"
        },
        {
          serverId: "srv-2",
          toolName: "beta",
          reasonCode: "tool-private"
        }
      ],
      selectedToolAllowed: true
    }
  },
  {
    name: "private-visibility-takes-precedence-over-missing-scope",
    input: {
      normalizedContext: {
        invocationId: "inv-private-precedence",
        traceId: "trace-6",
        normalizedMethod: "tools/call",
        normalizedToolName: "secret",
        tenantId: "tenant-5",
        userId: "user-6",
        agentId: "agent-6",
        scopes: [],
        requestPayload: {
          serverId: "srv-p"
        },
        requestTokenEstimate: 0,
        responseTokenEstimate: 0,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [
          {
            serverId: "srv-p",
            toolName: "secret",
            description: "Private secret tool",
            visibility: "private",
            scopeRequirements: ["scope:secret"]
          }
        ],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0,
          outputTokenPriceUsd: 0,
          requestBaseFeeUsd: 0
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 0
      },
      policyEvaluation: {
        decisionId: "policy-6",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      }
    },
    expected: {
      decisionId: "e07872e59466dfd092e94ddf71a5cc0ff3f981ee11db59ad4b285b0d4c1df9bf",
      status: "deny",
      allowedTools: [],
      blockedTools: [
        {
          serverId: "srv-p",
          toolName: "secret",
          reasonCode: "tool-private"
        }
      ],
      selectedToolAllowed: false
    }
  }
];
