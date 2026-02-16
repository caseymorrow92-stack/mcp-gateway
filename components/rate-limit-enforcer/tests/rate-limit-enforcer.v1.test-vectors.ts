import type { NormalizedProxyContextV1, PolicyEvaluationV1, RateLimitDecisionV1 } from "../../artifacts";
type RateLimitEnforcerInput = [NormalizedProxyContextV1, PolicyEvaluationV1];
type RateLimitEnforcerOutput = RateLimitDecisionV1;

const BASE_CONTEXT: NormalizedProxyContextV1 = {
  invocationId: "inv-001",
  traceId: "trace-001",
  normalizedMethod: "tools/call",
  normalizedToolName: "search",
  tenantId: "tenant-a",
  userId: "user-a",
  agentId: "agent-a",
  scopes: ["tools:call"],
  requestPayload: { q: "hello" },
  requestTokenEstimate: 10,
  responseTokenEstimate: 20,
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: {
    inputTokenPriceUsd: 0.000001,
    outputTokenPriceUsd: 0.000002,
    requestBaseFeeUsd: 0.001
  },
  historicalCallsInWindow: {},
  windowStartEpochMs: 100000
};

const ALLOW_POLICY: PolicyEvaluationV1 = {
  decisionId: "policy-allow",
  status: "allow",
  applicableRules: [],
  transformPatches: []
};

const DENY_POLICY: PolicyEvaluationV1 = {
  decisionId: "policy-deny",
  status: "deny",
  applicableRules: [],
  transformPatches: [],
  deniedReasonCode: "blocked"
};

export const TEST_VECTORS: Array<{
  name: string;
  input: RateLimitEnforcerInput;
  expected: RateLimitEnforcerOutput;
}> = [
  {
    name: "happy path: all rules pass and appliedRules are sorted",
    input: [
      {
        ...BASE_CONTEXT,
        invocationId: "inv-happy",
        normalizedToolName: "deploy",
        rateLimitRules: [
          { ruleId: "r-user", dimension: "user", windowSeconds: 60, limit: 10, keyTemplate: "" },
          { ruleId: "r-agent", dimension: "agent", windowSeconds: 15, limit: 5, keyTemplate: "" },
          { ruleId: "r-tool", dimension: "tool", windowSeconds: 30, limit: 8, keyTemplate: "" }
        ],
        historicalCallsInWindow: {
          "tenant-a:user-a": 3,
          "tenant-a:agent-a": 1,
          "tenant-a:deploy": 2
        }
      },
      ALLOW_POLICY
    ],
    expected: {
      decisionId: "37f90e3be5e2fea5c3ddbee6fd66cba4fc5d3e5aba0833cc0e4c68290eac057b",
      status: "allow",
      allowed: true,
      retryAfterSeconds: 0,
      appliedRules: [
        {
          ruleId: "r-agent",
          dimension: "agent",
          key: "tenant-a:agent-a",
          windowSeconds: 15,
          limit: 5,
          observedCount: 1
        },
        {
          ruleId: "r-tool",
          dimension: "tool",
          key: "tenant-a:deploy",
          windowSeconds: 30,
          limit: 8,
          observedCount: 2
        },
        {
          ruleId: "r-user",
          dimension: "user",
          key: "tenant-a:user-a",
          windowSeconds: 60,
          limit: 10,
          observedCount: 3
        }
      ]
    }
  },
  {
    name: "edge case: empty rules allow with no applied rules",
    input: [{ ...BASE_CONTEXT, invocationId: "inv-empty", rateLimitRules: [] }, ALLOW_POLICY],
    expected: {
      decisionId: "522a4fa6cb9ff52ae811b11f25f28d13ba763456d45a3d6eb771dc0af8572ffa",
      status: "allow",
      allowed: true,
      retryAfterSeconds: 0,
      appliedRules: []
    }
  },
  {
    name: "edge case: policy deny short-circuits before rate-limit checks",
    input: [
      {
        ...BASE_CONTEXT,
        invocationId: "inv-policy-deny",
        rateLimitRules: [{ ruleId: "r1", dimension: "user", windowSeconds: 60, limit: 1, keyTemplate: "" }],
        historicalCallsInWindow: { "tenant-a:user-a": 0 }
      },
      DENY_POLICY
    ],
    expected: {
      decisionId: "bc9d76c07e322ef690ffeaaae8b0210ceb4a8e48dbfe97f077635f960526d8b0",
      status: "deny",
      allowed: false,
      retryAfterSeconds: 0,
      appliedRules: [],
      deniedReasonCode: "policy-deny"
    }
  },
  {
    name: "edge case: missing historical key defaults to zero and passes",
    input: [
      {
        ...BASE_CONTEXT,
        invocationId: "inv-missing-key",
        rateLimitRules: [{ ruleId: "r1", dimension: "tool", windowSeconds: 60, limit: 1, keyTemplate: "" }],
        normalizedToolName: "summarize",
        historicalCallsInWindow: {}
      },
      ALLOW_POLICY
    ],
    expected: {
      decisionId: "b410f25876e98d09600f60e5b46a15cfdf63b63ca8d76dc1db871771dee682cd",
      status: "allow",
      allowed: true,
      retryAfterSeconds: 0,
      appliedRules: [
        {
          ruleId: "r1",
          dimension: "tool",
          key: "tenant-a:summarize",
          windowSeconds: 60,
          limit: 1,
          observedCount: 0
        }
      ]
    }
  },
  {
    name: "edge case: minimal single-rule failure denies with retry-after",
    input: [
      {
        ...BASE_CONTEXT,
        invocationId: "inv-fail",
        rateLimitRules: [{ ruleId: "r1", dimension: "user", windowSeconds: 60, limit: 3, keyTemplate: "" }],
        historicalCallsInWindow: { "tenant-a:user-a": 3 },
        windowStartEpochMs: 100000,
        receivedAtEpochMs: 115000
      } as NormalizedProxyContextV1 & { receivedAtEpochMs: number },
      ALLOW_POLICY
    ],
    expected: {
      decisionId: "3473f739f67c735a785b71d11131f8aa12f69e2a590c768d7e7b52825583df0b",
      status: "deny",
      allowed: false,
      retryAfterSeconds: 45,
      appliedRules: [
        {
          ruleId: "r1",
          dimension: "user",
          key: "tenant-a:user-a",
          windowSeconds: 60,
          limit: 3,
          observedCount: 3
        }
      ],
      deniedReasonCode: "rate-limit-exceeded"
    }
  }
];
