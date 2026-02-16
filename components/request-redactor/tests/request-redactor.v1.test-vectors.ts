import type {
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RedactedRequestV1,
  ToolFilterDecisionV1
} from "../../artifacts";
import { COMPONENT_CONTRACT } from "../contract";
import { redactRequest } from "../index";

type ArtifactMap = {
  NormalizedProxyContextV1: NormalizedProxyContextV1;
  PolicyEvaluationV1: PolicyEvaluationV1;
  ToolFilterDecisionV1: ToolFilterDecisionV1;
  RedactedRequestV1: RedactedRequestV1;
};

type InputArtifactId = (typeof COMPONENT_CONTRACT.inputs)[number];
type OutputArtifactId = (typeof COMPONENT_CONTRACT.outputs)[number];

export type RequestRedactorInput = {
  normalizedContext: ArtifactMap[Extract<InputArtifactId, "NormalizedProxyContextV1">];
  policyEvaluation: ArtifactMap[Extract<InputArtifactId, "PolicyEvaluationV1">];
  toolFilterDecision: ArtifactMap[Extract<InputArtifactId, "ToolFilterDecisionV1">];
};

export type RequestRedactorOutput = ArtifactMap[Extract<OutputArtifactId, "RedactedRequestV1">];

export type RequestRedactorTestVector = {
  name: string;
  input: RequestRedactorInput;
  expected: RequestRedactorOutput;
};

const BASE_CONTEXT: Omit<NormalizedProxyContextV1, "invocationId" | "requestPayload" | "redactionRules"> = {
  traceId: "trace-1",
  normalizedMethod: "tools.call",
  normalizedToolName: "search",
  tenantId: "tenant-1",
  userId: "user-1",
  agentId: "agent-1",
  scopes: ["read"],
  requestTokenEstimate: 100,
  responseTokenEstimate: 200,
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [
    {
      serverId: "server-b",
      toolName: "search",
      description: "Search tool",
      visibility: "public",
      scopeRequirements: []
    },
    {
      serverId: "server-a",
      toolName: "search",
      description: "Search tool alt",
      visibility: "public",
      scopeRequirements: []
    }
  ],
  pricing: {
    inputTokenPriceUsd: 0.00001,
    outputTokenPriceUsd: 0.00002,
    requestBaseFeeUsd: 0.001
  },
  historicalCallsInWindow: {},
  windowStartEpochMs: 1700000000000
};

const ALLOW_POLICY: PolicyEvaluationV1 = {
  decisionId: "policy-allow",
  status: "allow",
  applicableRules: [],
  transformPatches: []
};

const POLICY_DENY: PolicyEvaluationV1 = {
  decisionId: "policy-deny",
  status: "deny",
  applicableRules: [],
  transformPatches: [],
  deniedReasonCode: "policy.blocked"
};

const TOOL_ALLOWED: ToolFilterDecisionV1 = {
  decisionId: "tool-allow",
  status: "allow",
  allowedTools: [
    {
      serverId: "server-a",
      toolName: "search",
      summarizedDescription: "ok"
    }
  ],
  blockedTools: [],
  selectedToolAllowed: true
};

const TOOL_BLOCKED: ToolFilterDecisionV1 = {
  decisionId: "tool-block",
  status: "deny",
  allowedTools: [],
  blockedTools: [
    {
      serverId: "server-a",
      toolName: "search",
      reasonCode: "scope-missing"
    }
  ],
  selectedToolAllowed: false
};

export const TEST_VECTORS: RequestRedactorTestVector[] = [
  {
    name: "happy path applies mask/hash/drop with deterministic ordering",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-happy",
        requestPayload: {
          secret: "super-secret-token",
          pii: {
            email: "user@example.com"
          },
          nested: {
            removeMe: "to-delete"
          },
          untouched: "ok"
        },
        redactionRules: [
          { ruleId: "r3", mode: "drop", matchPath: "nested.removeMe", replacement: "" },
          { ruleId: "r2", mode: "hash", matchPath: "pii.email", replacement: "" },
          { ruleId: "r1", mode: "mask", matchPath: "secret", replacement: "***" }
        ]
      },
      policyEvaluation: ALLOW_POLICY,
      toolFilterDecision: TOOL_ALLOWED
    },
    expected: {
      decisionId: "562d84dc40b9f0f8c7e905b4ef967ea334e84e0553ca7546acec6c08db01b1c6",
      status: "transform",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        secret: "***",
        pii: {
          email: "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"
        },
        nested: {},
        untouched: "ok"
      },
      redactionEvents: [
        {
          ruleId: "r3",
          locationPath: "nested.removeMe",
          mode: "drop",
          originalPreview: "to-delete",
          replacementPreview: "[dropped]"
        },
        {
          ruleId: "r2",
          locationPath: "pii.email",
          mode: "hash",
          originalPreview: "user@example.com",
          replacementPreview: "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"
        },
        {
          ruleId: "r1",
          locationPath: "secret",
          mode: "mask",
          originalPreview: "super-secret-token",
          replacementPreview: "***"
        }
      ]
    }
  },
  {
    name: "empty redaction rule set passes through unchanged",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-empty-rules",
        requestPayload: {
          q: "hello"
        },
        redactionRules: []
      },
      policyEvaluation: ALLOW_POLICY,
      toolFilterDecision: TOOL_ALLOWED
    },
    expected: {
      decisionId: "1e0cbb1e5463364902ac4bfda635a082bcb5e97b133b3a883d85f3e27eb1d4f2",
      status: "allow",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        q: "hello"
      },
      redactionEvents: []
    }
  },
  {
    name: "minimal input with one matching field yields one event",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-minimal",
        requestPayload: {
          token: "abc"
        },
        redactionRules: [{ ruleId: "r1", mode: "mask", matchPath: "token", replacement: "***" }]
      },
      policyEvaluation: ALLOW_POLICY,
      toolFilterDecision: TOOL_ALLOWED
    },
    expected: {
      decisionId: "0e434d462dca20eabd0d40df92a416f8ca454d62f90ef3a8d704e2450b425803",
      status: "transform",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        token: "***"
      },
      redactionEvents: [
        {
          ruleId: "r1",
          locationPath: "token",
          mode: "mask",
          originalPreview: "abc",
          replacementPreview: "***"
        }
      ]
    }
  },
  {
    name: "non-object traversal at match path skips event",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-non-object",
        requestPayload: {
          meta: "not-object",
          keep: 1
        },
        redactionRules: [{ ruleId: "r1", mode: "mask", matchPath: "meta.email", replacement: "***" }]
      },
      policyEvaluation: ALLOW_POLICY,
      toolFilterDecision: TOOL_ALLOWED
    },
    expected: {
      decisionId: "b2b867b116ccd31508803e052abfa9b7a1ce4168a9919a9d3fb3b22b79967816",
      status: "allow",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        meta: "not-object",
        keep: 1
      },
      redactionEvents: []
    }
  },
  {
    name: "policy deny short-circuits to deny without redaction",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-policy-deny",
        requestPayload: {
          token: "abc"
        },
        redactionRules: [{ ruleId: "r1", mode: "mask", matchPath: "token", replacement: "***" }]
      },
      policyEvaluation: POLICY_DENY,
      toolFilterDecision: TOOL_ALLOWED
    },
    expected: {
      decisionId: "946c8a73ee842dd559b76bee9d636e6582b768770e987e55971441391c30b938",
      status: "deny",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        token: "abc"
      },
      redactionEvents: []
    }
  },
  {
    name: "blocked selected tool short-circuits to deny without redaction",
    input: {
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-tool-blocked",
        requestPayload: {
          token: "abc"
        },
        redactionRules: [{ ruleId: "r1", mode: "mask", matchPath: "token", replacement: "***" }]
      },
      policyEvaluation: ALLOW_POLICY,
      toolFilterDecision: TOOL_BLOCKED
    },
    expected: {
      decisionId: "c298f278ef8774d69dc5ef1a6d2124eda175689bddac7891fb762c922e0d0ff0",
      status: "deny",
      serverId: "server-a",
      toolName: "search",
      arguments: {
        token: "abc"
      },
      redactionEvents: []
    }
  }
] as const;

void redactRequest;
