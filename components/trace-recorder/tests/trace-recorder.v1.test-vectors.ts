import type {
  AuthEvaluationV1,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RateLimitDecisionV1,
  RedactedResponseV1,
  UpstreamExecutionResultV1
} from "../../artifacts";
import { recordTrace } from "../index";

type TraceRecorderInput = Parameters<typeof recordTrace>[0];
type TraceRecorderOutput = ReturnType<typeof recordTrace>;

type TestVector = {
  name: string;
  input: TraceRecorderInput;
  expected: TraceRecorderOutput;
};

const HAPPY_PATH_NORMALIZED_CONTEXT: NormalizedProxyContextV1 = {
  invocationId: "inv-001",
  traceId: "trace-001",
  normalizedMethod: "tools/call",
  normalizedToolName: "search_docs",
  tenantId: "tenant-a",
  userId: "user-a",
  agentId: "agent-a",
  scopes: ["docs:read"],
  requestPayload: {
    query: "mcp"
  },
  requestTokenEstimate: 30,
  responseTokenEstimate: 12,
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
  windowStartEpochMs: 1700000000000
};

const HAPPY_PATH_AUTH_EVALUATION: AuthEvaluationV1 = {
  decisionId: "auth-1",
  authenticated: true,
  status: "allow",
  principal: {
    tenantId: "tenant-a",
    userId: "user-a",
    agentId: "agent-a",
    effectiveScopes: ["docs:read"]
  },
  failedChecks: [],
  reasonCode: "auth.ok"
};

const HAPPY_PATH_POLICY_EVALUATION: PolicyEvaluationV1 = {
  decisionId: "pol-1",
  status: "transform",
  applicableRules: [],
  transformPatches: [
    {
      path: "/arguments/query",
      op: "set",
      value: "MCP"
    }
  ]
};

const HAPPY_PATH_RATE_LIMIT_DECISION: RateLimitDecisionV1 = {
  decisionId: "rate-1",
  status: "allow",
  allowed: true,
  retryAfterSeconds: 0,
  appliedRules: []
};

const HAPPY_PATH_UPSTREAM_RESULT: UpstreamExecutionResultV1 = {
  decisionId: "up-1",
  status: "allow",
  dispatched: true,
  httpStatusCode: 200,
  upstreamLatencyMs: 48,
  upstreamResponse: {
    result: {
      ok: true
    }
  }
};

const HAPPY_PATH_REDACTED_RESPONSE: RedactedResponseV1 = {
  decisionId: "resp-1",
  status: "transform",
  responsePayload: {
    ok: true,
    token: "***"
  },
  redactionEvents: [
    {
      ruleId: "rr-1",
      locationPath: "$.token",
      mode: "mask",
      originalPreview: "abc",
      replacementPreview: "***"
    }
  ],
  containsSensitiveData: false
};

export const TEST_VECTORS: TestVector[] = [
  {
    name: "happy path transform flow",
    input: {
      normalizedContext: HAPPY_PATH_NORMALIZED_CONTEXT,
      authEvaluation: HAPPY_PATH_AUTH_EVALUATION,
      policyEvaluation: HAPPY_PATH_POLICY_EVALUATION,
      rateLimitDecision: HAPPY_PATH_RATE_LIMIT_DECISION,
      upstreamExecutionResult: HAPPY_PATH_UPSTREAM_RESULT,
      redactedResponse: HAPPY_PATH_REDACTED_RESPONSE
    },
    expected: {
      traceId: "trace-001",
      spans: [
        {
          spanId: "16f881baa42bdd9ce5e206d94421f398684e98c423bd08e25d4b2f92f4e3ce68",
          spanKind: "middleware",
          spanName: "authenticate",
          stage: "authenticate",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "2669674b3cd728b7a11fa4dc43fcc8ce30897cfd7c99a834979b6f1bb2ff6c0b",
          spanKind: "middleware",
          spanName: "cost-meter",
          stage: "cost-meter",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "504956ca58e013e3b1a8990206d47f7049046d3e5186399de45dc416cd08b29d",
          spanKind: "middleware",
          spanName: "policy",
          stage: "policy",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "transform"
          }
        },
        {
          spanId: "640945d497e398a6ab4e4882a1f6ef8b8e1bdcbacf31dc9b269fc750e13e025b",
          spanKind: "middleware",
          spanName: "rate-limit",
          stage: "rate-limit",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "f6447064879882d632f1779feccfe0b6f684c20ab7a51e17b08015df46616a4d",
          spanKind: "middleware",
          spanName: "response-redaction",
          stage: "response-redaction",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "transform"
          }
        },
        {
          spanId: "62c731fd967d7c35f3584d5ed4fe9f020144da422e8322cdc43c6c6c850a9ae8",
          spanKind: "upstream",
          spanName: "dispatch",
          stage: "dispatch",
          status: "ok",
          attributes: {
            tenantId: "tenant-a",
            userId: "user-a",
            agentId: "agent-a",
            toolName: "search_docs",
            decisionStatus: "allow"
          }
        }
      ],
      metrics: [
        {
          key: "middleware.blocked",
          value: 0
        },
        {
          key: "middleware.http_status",
          value: 200
        },
        {
          key: "middleware.redaction_events",
          value: 1
        },
        {
          key: "middleware.upstream_latency_ms",
          value: 48
        }
      ],
      exportTarget: "otel-collector"
    }
  },
  {
    name: "minimal allow flow",
    input: {
      normalizedContext: {
        invocationId: "inv-min",
        traceId: "trace-min",
        normalizedMethod: "tools/call",
        normalizedToolName: "noop",
        tenantId: "t",
        userId: "u",
        agentId: "a",
        scopes: [],
        requestPayload: {},
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
      authEvaluation: {
        decisionId: "a",
        authenticated: true,
        status: "allow",
        principal: {
          tenantId: "t",
          userId: "u",
          agentId: "a",
          effectiveScopes: []
        },
        failedChecks: [],
        reasonCode: "ok"
      },
      policyEvaluation: {
        decisionId: "p",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      },
      rateLimitDecision: {
        decisionId: "r",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      upstreamExecutionResult: {
        decisionId: "d",
        status: "allow",
        dispatched: true,
        httpStatusCode: 204,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          result: {}
        }
      },
      redactedResponse: {
        decisionId: "rr",
        status: "allow",
        responsePayload: {},
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      traceId: "trace-min",
      spans: [
        {
          spanId: "bfcc1259833950873bdd952553d686f19ad499df92e85192d009ffa2dd765f18",
          spanKind: "middleware",
          spanName: "authenticate",
          stage: "authenticate",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "3f6d5d6bb09e84776006e8246d37b676ba1b09e79a58408ada672042bfa3f48c",
          spanKind: "middleware",
          spanName: "cost-meter",
          stage: "cost-meter",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "2817269a230946770ff65bca90d645100adfc64d0f80ff99872f109b480af17f",
          spanKind: "middleware",
          spanName: "policy",
          stage: "policy",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "e58c6a1b12084a5d80a265f613d44e4b2093b8687eaf1094db89031f087c4908",
          spanKind: "middleware",
          spanName: "rate-limit",
          stage: "rate-limit",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "ce6cfa57a39ae04a374e45bac7138154a9d47e2bc129dd099242edf26d5a501b",
          spanKind: "middleware",
          spanName: "response-redaction",
          stage: "response-redaction",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "1871cef428f6ccf35d7dff69e75955a5aaeeacefb28bded5a0f61563f9ffe635",
          spanKind: "upstream",
          spanName: "dispatch",
          stage: "dispatch",
          status: "ok",
          attributes: {
            tenantId: "t",
            userId: "u",
            agentId: "a",
            toolName: "noop",
            decisionStatus: "allow"
          }
        }
      ],
      metrics: [
        {
          key: "middleware.blocked",
          value: 0
        },
        {
          key: "middleware.http_status",
          value: 204
        },
        {
          key: "middleware.redaction_events",
          value: 0
        },
        {
          key: "middleware.upstream_latency_ms",
          value: 0
        }
      ],
      exportTarget: "otel-collector"
    }
  },
  {
    name: "blocked flow with missing traceId fallback",
    input: {
      normalizedContext: {
        invocationId: "inv-fallback",
        traceId: "",
        normalizedMethod: "tools/call",
        normalizedToolName: "restricted_tool",
        tenantId: "tenant-z",
        userId: "user-z",
        agentId: "agent-z",
        scopes: ["tools:read"],
        requestPayload: {},
        requestTokenEstimate: 10,
        responseTokenEstimate: 0,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.1,
          outputTokenPriceUsd: 0.2,
          requestBaseFeeUsd: 1
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 1
      },
      authEvaluation: {
        decisionId: "a2",
        authenticated: true,
        status: "allow",
        principal: {
          tenantId: "tenant-z",
          userId: "user-z",
          agentId: "agent-z",
          effectiveScopes: ["tools:read"]
        },
        failedChecks: [],
        reasonCode: "ok"
      },
      policyEvaluation: {
        decisionId: "p2",
        status: "deny",
        applicableRules: [
          {
            ruleId: "deny-1",
            stage: "policy",
            status: "deny",
            reasonCode: "policy.blocked",
            priority: 1
          }
        ],
        transformPatches: [],
        deniedReasonCode: "policy.blocked"
      },
      rateLimitDecision: {
        decisionId: "r2",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      upstreamExecutionResult: {
        decisionId: "d2",
        status: "deny",
        dispatched: false,
        blockedByStage: "policy",
        httpStatusCode: 403,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          error: {
            code: "DENIED",
            message: "blocked"
          }
        }
      },
      redactedResponse: {
        decisionId: "rr2",
        status: "allow",
        responsePayload: {
          error: "blocked"
        },
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      traceId: "ba86491bcc3a6dba434a3ecf8aaf22eb24849cc9563d1ca2be35cad5c9c4b32a",
      spans: [
        {
          spanId: "9721a57e9b39f61f87193f0c9cad03dd17eed5da224276d6a5789b223df01659",
          spanKind: "middleware",
          spanName: "authenticate",
          stage: "authenticate",
          status: "ok",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "e1aa379fe58f4623f06ffdf596b8e6d8794ca4ebfe4ce0bb53c5a7860f5aec22",
          spanKind: "middleware",
          spanName: "cost-meter",
          stage: "cost-meter",
          status: "error",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "deny"
          }
        },
        {
          spanId: "779923c44969e29fcd5af0abee3ba80589c77dc43b637048f7b8539b28ce98fe",
          spanKind: "middleware",
          spanName: "policy",
          stage: "policy",
          status: "error",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "deny"
          }
        },
        {
          spanId: "5bbffb34d7f7d388d79482be9164075bd1656acc9567c600ac5bc8f84ea90e80",
          spanKind: "middleware",
          spanName: "rate-limit",
          stage: "rate-limit",
          status: "ok",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "fd5f0d408ee1d4c5ee4454fe6c810d34afaaf631062b90fabdc60dafedc4ef4b",
          spanKind: "middleware",
          spanName: "response-redaction",
          stage: "response-redaction",
          status: "ok",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "allow"
          }
        },
        {
          spanId: "d8954ce6350fb1be3e266b4814ab7f4fa8906c39c62d280994489caf60270f01",
          spanKind: "upstream",
          spanName: "dispatch",
          stage: "dispatch",
          status: "error",
          attributes: {
            tenantId: "tenant-z",
            userId: "user-z",
            agentId: "agent-z",
            toolName: "restricted_tool",
            decisionStatus: "deny"
          }
        }
      ],
      metrics: [
        {
          key: "middleware.blocked",
          value: 1
        },
        {
          key: "middleware.http_status",
          value: 403
        },
        {
          key: "middleware.redaction_events",
          value: 0
        },
        {
          key: "middleware.upstream_latency_ms",
          value: 0
        }
      ],
      exportTarget: "otel-collector"
    }
  }
];
