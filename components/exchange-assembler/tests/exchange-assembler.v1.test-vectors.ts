import type { MiddlewareExecutionReportV1 } from "../../artifacts";
import type { assembleExchange } from "../index";

type ExchangeAssemblerInput = Parameters<typeof assembleExchange>[0];

export type ExchangeAssemblerTestVector = {
  name: string;
  input: ExchangeAssemblerInput;
  expected: MiddlewareExecutionReportV1;
};

export const TEST_VECTORS: ExchangeAssemblerTestVector[] = [
  {
    name: "happy path: served with complete middleware decisions",
    input: {
      normalizedContext: {
        invocationId: "inv-1",
        traceId: "trace-1",
        normalizedMethod: "tools/call",
        normalizedToolName: "search",
        tenantId: "tenant-a",
        userId: "user-a",
        agentId: "agent-a",
        scopes: ["tools:read"],
        requestPayload: { q: "alpha" },
        requestTokenEstimate: 120,
        responseTokenEstimate: 80,
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
        windowStartEpochMs: 1000
      },
      authEvaluation: {
        decisionId: "auth-1",
        authenticated: true,
        status: "allow",
        principal: {
          tenantId: "tenant-a",
          userId: "user-a",
          agentId: "agent-a",
          effectiveScopes: ["tools:read"]
        },
        failedChecks: [],
        reasonCode: "auth:ok"
      },
      policyEvaluation: {
        decisionId: "pol-1",
        status: "allow",
        applicableRules: [
          {
            ruleId: "policy-rule-1",
            stage: "policy",
            status: "allow",
            reasonCode: "policy:allow",
            priority: 1
          }
        ],
        transformPatches: []
      },
      toolFilterDecision: {
        decisionId: "tool-1",
        status: "allow",
        allowedTools: [
          {
            serverId: "server-a",
            toolName: "search",
            summarizedDescription: "search tool"
          }
        ],
        blockedTools: [],
        selectedToolAllowed: true
      },
      rateLimitDecision: {
        decisionId: "rate-1",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      redactedRequest: {
        decisionId: "req-redact-1",
        status: "transform",
        serverId: "server-a",
        toolName: "search",
        arguments: { q: "alpha" },
        redactionEvents: [
          {
            ruleId: "mask-query",
            locationPath: "$.q",
            mode: "mask",
            originalPreview: "alpha",
            replacementPreview: "a***"
          }
        ]
      },
      upstreamExecutionResult: {
        decisionId: "dispatch-1",
        status: "allow",
        dispatched: true,
        httpStatusCode: 200,
        upstreamLatencyMs: 45,
        upstreamResponse: {
          result: { ok: true }
        }
      },
      redactedResponse: {
        decisionId: "resp-redact-1",
        status: "allow",
        responsePayload: { ok: true },
        redactionEvents: [],
        containsSensitiveData: false
      },
      traceRecordSet: {
        traceId: "trace-1",
        spans: [
          {
            spanId: "span-1",
            spanKind: "middleware",
            spanName: "auth",
            stage: "authenticate",
            status: "ok",
            attributes: { component: "auth-evaluator" }
          },
          {
            spanId: "span-2",
            spanKind: "upstream",
            spanName: "dispatch",
            stage: "dispatch",
            status: "ok",
            attributes: { httpStatusCode: 200 }
          }
        ],
        metrics: [
          { key: "latencyMs", value: 45 },
          { key: "tokens", value: 200 }
        ],
        exportTarget: "otel"
      },
      costMeteringRecord: {
        costRecordId: "cost-1",
        invocationId: "inv-1",
        lineItems: [
          {
            category: "base-request",
            dimensionKey: "request",
            quantity: 1,
            unitPriceUsd: 0.01,
            subtotalUsd: 0.01
          }
        ],
        totalUsd: 0.01,
        usage: {
          inputTokens: 120,
          outputTokens: 80,
          totalTokens: 200
        }
      }
    },
    expected: {
      executionReportId: "cbd5c6f4fce56c81008864fd913632ec8322e24d33f2892c363519e7f860cd28",
      invocationId: "inv-1",
      traceId: "trace-1",
      finalStatus: "served",
      middlewareDecisions: [
        {
          componentId: "auth-evaluator",
          stage: "authenticate",
          status: "allow",
          reasonCode: "auth:ok",
          decisionId: "auth-1"
        },
        {
          componentId: "cost-meter",
          stage: "cost-meter",
          status: "observe-only",
          reasonCode: "cost:computed",
          decisionId: "cost-1"
        },
        {
          componentId: "upstream-dispatcher",
          stage: "dispatch",
          status: "allow",
          reasonCode: "dispatch:dispatched",
          decisionId: "dispatch-1"
        },
        {
          componentId: "policy-evaluator",
          stage: "policy",
          status: "allow",
          reasonCode: "policy:allow",
          decisionId: "pol-1"
        },
        {
          componentId: "rate-limit-enforcer",
          stage: "rate-limit",
          status: "allow",
          reasonCode: "rate-limit:allowed",
          decisionId: "rate-1"
        },
        {
          componentId: "request-redactor",
          stage: "request-redaction",
          status: "transform",
          reasonCode: "request-redaction:mask-query",
          decisionId: "req-redact-1"
        },
        {
          componentId: "response-redactor",
          stage: "response-redaction",
          status: "allow",
          reasonCode: "response-redaction:none",
          decisionId: "resp-redact-1"
        },
        {
          componentId: "tool-visibility-filter",
          stage: "tool-filter",
          status: "allow",
          reasonCode: "tool-filter:allowed",
          decisionId: "tool-1"
        },
        {
          componentId: "trace-recorder",
          stage: "trace",
          status: "observe-only",
          reasonCode: "otel",
          decisionId: "trace-1"
        }
      ],
      requestSummary: {
        tenantId: "tenant-a",
        userId: "user-a",
        agentId: "agent-a",
        serverId: "server-a",
        toolName: "search"
      },
      enforcementSummary: {
        authPassed: true,
        policyStatus: "allow",
        rateLimitAllowed: true,
        selectedToolAllowed: true
      },
      observability: {
        spanCount: 2,
        metricCount: 2
      },
      cost: {
        totalUsd: 0.01,
        totalTokens: 200
      },
      response: {
        httpStatusCode: 200,
        dispatched: true,
        containsSensitiveData: false
      }
    }
  },
  {
    name: "edge case: minimal blocked auth flow",
    input: {
      normalizedContext: {
        invocationId: "inv-2",
        traceId: "trace-2",
        normalizedMethod: "tools/call",
        normalizedToolName: "restricted-tool",
        tenantId: "tenant-b",
        userId: "user-b",
        agentId: "agent-b",
        scopes: [],
        requestPayload: {},
        requestTokenEstimate: 1,
        responseTokenEstimate: 1,
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
        decisionId: "auth-2",
        authenticated: false,
        status: "deny",
        principal: {
          tenantId: "tenant-b",
          userId: "user-b",
          agentId: "agent-b",
          effectiveScopes: []
        },
        failedChecks: ["signature"],
        reasonCode: "auth:invalid-signature"
      },
      policyEvaluation: {
        decisionId: "pol-2",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      },
      toolFilterDecision: {
        decisionId: "tool-2",
        status: "allow",
        allowedTools: [],
        blockedTools: [],
        selectedToolAllowed: true
      },
      rateLimitDecision: {
        decisionId: "rate-2",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      redactedRequest: {
        decisionId: "req-redact-2",
        status: "allow",
        serverId: "server-b",
        toolName: "restricted-tool",
        arguments: {},
        redactionEvents: []
      },
      upstreamExecutionResult: {
        decisionId: "dispatch-2",
        status: "deny",
        dispatched: false,
        blockedByStage: "authenticate",
        httpStatusCode: 401,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          error: {
            code: "UNAUTHORIZED",
            message: "auth failed"
          }
        }
      },
      redactedResponse: {
        decisionId: "resp-redact-2",
        status: "allow",
        responsePayload: { error: "unauthorized" },
        redactionEvents: [],
        containsSensitiveData: false
      },
      traceRecordSet: {
        traceId: "trace-2",
        spans: [],
        metrics: [],
        exportTarget: "otel"
      },
      costMeteringRecord: {
        costRecordId: "cost-2",
        invocationId: "inv-2",
        lineItems: [],
        totalUsd: 0,
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2
        }
      }
    },
    expected: {
      executionReportId: "2605bdb6d69031647ada6ea9f7e20c5d17d921b11c642d35f223ea283dd5133d",
      invocationId: "inv-2",
      traceId: "trace-2",
      finalStatus: "blocked",
      middlewareDecisions: [
        {
          componentId: "auth-evaluator",
          stage: "authenticate",
          status: "deny",
          reasonCode: "auth:invalid-signature",
          decisionId: "auth-2"
        },
        {
          componentId: "cost-meter",
          stage: "cost-meter",
          status: "observe-only",
          reasonCode: "cost:computed",
          decisionId: "cost-2"
        },
        {
          componentId: "upstream-dispatcher",
          stage: "dispatch",
          status: "deny",
          reasonCode: "dispatch:blocked-by-authenticate",
          decisionId: "dispatch-2"
        },
        {
          componentId: "policy-evaluator",
          stage: "policy",
          status: "allow",
          reasonCode: "policy:unspecified",
          decisionId: "pol-2"
        },
        {
          componentId: "rate-limit-enforcer",
          stage: "rate-limit",
          status: "allow",
          reasonCode: "rate-limit:allowed",
          decisionId: "rate-2"
        },
        {
          componentId: "request-redactor",
          stage: "request-redaction",
          status: "allow",
          reasonCode: "request-redaction:none",
          decisionId: "req-redact-2"
        },
        {
          componentId: "response-redactor",
          stage: "response-redaction",
          status: "allow",
          reasonCode: "response-redaction:none",
          decisionId: "resp-redact-2"
        },
        {
          componentId: "tool-visibility-filter",
          stage: "tool-filter",
          status: "allow",
          reasonCode: "tool-filter:allowed",
          decisionId: "tool-2"
        },
        {
          componentId: "trace-recorder",
          stage: "trace",
          status: "observe-only",
          reasonCode: "otel",
          decisionId: "trace-2"
        }
      ],
      requestSummary: {
        tenantId: "tenant-b",
        userId: "user-b",
        agentId: "agent-b",
        serverId: "server-b",
        toolName: "restricted-tool"
      },
      enforcementSummary: {
        authPassed: false,
        policyStatus: "allow",
        rateLimitAllowed: true,
        selectedToolAllowed: true
      },
      observability: {
        spanCount: 0,
        metricCount: 0
      },
      cost: {
        totalUsd: 0,
        totalTokens: 2
      },
      response: {
        httpStatusCode: 401,
        dispatched: false,
        containsSensitiveData: false
      }
    }
  },
  {
    name: "edge case: empty internal arrays still emits all stage rows",
    input: {
      normalizedContext: {
        invocationId: "inv-3",
        traceId: "trace-3",
        normalizedMethod: "tools/call",
        normalizedToolName: "echo",
        tenantId: "tenant-c",
        userId: "user-c",
        agentId: "agent-c",
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
        decisionId: "auth-3",
        authenticated: true,
        status: "allow",
        principal: {
          tenantId: "tenant-c",
          userId: "user-c",
          agentId: "agent-c",
          effectiveScopes: []
        },
        failedChecks: [],
        reasonCode: "auth:ok"
      },
      policyEvaluation: {
        decisionId: "pol-3",
        status: "allow",
        applicableRules: [],
        transformPatches: []
      },
      toolFilterDecision: {
        decisionId: "tool-3",
        status: "allow",
        allowedTools: [],
        blockedTools: [],
        selectedToolAllowed: true
      },
      rateLimitDecision: {
        decisionId: "rate-3",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      redactedRequest: {
        decisionId: "req-redact-3",
        status: "allow",
        serverId: "server-c",
        toolName: "",
        arguments: {},
        redactionEvents: []
      },
      upstreamExecutionResult: {
        decisionId: "dispatch-3",
        status: "allow",
        dispatched: true,
        httpStatusCode: 204,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          result: {}
        }
      },
      redactedResponse: {
        decisionId: "resp-redact-3",
        status: "allow",
        responsePayload: {},
        redactionEvents: [],
        containsSensitiveData: false
      },
      traceRecordSet: {
        traceId: "trace-3",
        spans: [],
        metrics: [],
        exportTarget: ""
      },
      costMeteringRecord: {
        costRecordId: "cost-3",
        invocationId: "inv-3",
        lineItems: [],
        totalUsd: 0,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        }
      }
    },
    expected: {
      executionReportId: "548fc95eb69efed328851754784807325e814fb1a73c52ac2343fcaccfe03e83",
      invocationId: "inv-3",
      traceId: "trace-3",
      finalStatus: "served",
      middlewareDecisions: [
        {
          componentId: "auth-evaluator",
          stage: "authenticate",
          status: "allow",
          reasonCode: "auth:ok",
          decisionId: "auth-3"
        },
        {
          componentId: "cost-meter",
          stage: "cost-meter",
          status: "observe-only",
          reasonCode: "cost:computed",
          decisionId: "cost-3"
        },
        {
          componentId: "upstream-dispatcher",
          stage: "dispatch",
          status: "allow",
          reasonCode: "dispatch:dispatched",
          decisionId: "dispatch-3"
        },
        {
          componentId: "policy-evaluator",
          stage: "policy",
          status: "allow",
          reasonCode: "policy:unspecified",
          decisionId: "pol-3"
        },
        {
          componentId: "rate-limit-enforcer",
          stage: "rate-limit",
          status: "allow",
          reasonCode: "rate-limit:allowed",
          decisionId: "rate-3"
        },
        {
          componentId: "request-redactor",
          stage: "request-redaction",
          status: "allow",
          reasonCode: "request-redaction:none",
          decisionId: "req-redact-3"
        },
        {
          componentId: "response-redactor",
          stage: "response-redaction",
          status: "allow",
          reasonCode: "response-redaction:none",
          decisionId: "resp-redact-3"
        },
        {
          componentId: "tool-visibility-filter",
          stage: "tool-filter",
          status: "allow",
          reasonCode: "tool-filter:allowed",
          decisionId: "tool-3"
        },
        {
          componentId: "trace-recorder",
          stage: "trace",
          status: "observe-only",
          reasonCode: "trace:unspecified",
          decisionId: "trace-3"
        }
      ],
      requestSummary: {
        tenantId: "tenant-c",
        userId: "user-c",
        agentId: "agent-c",
        serverId: "server-c",
        toolName: "echo"
      },
      enforcementSummary: {
        authPassed: true,
        policyStatus: "allow",
        rateLimitAllowed: true,
        selectedToolAllowed: true
      },
      observability: {
        spanCount: 0,
        metricCount: 0
      },
      cost: {
        totalUsd: 0,
        totalTokens: 0
      },
      response: {
        httpStatusCode: 204,
        dispatched: true,
        containsSensitiveData: false
      }
    }
  },
  {
    name: "edge case: inconsistent artifact IDs are preserved as-is",
    input: {
      normalizedContext: {
        invocationId: "inv-4",
        traceId: "trace-4",
        normalizedMethod: "tools/call",
        normalizedToolName: "tool-from-normalized",
        tenantId: "tenant-d",
        userId: "user-d",
        agentId: "agent-d",
        scopes: ["tools:write"],
        requestPayload: {},
        requestTokenEstimate: 20,
        responseTokenEstimate: 10,
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
        windowStartEpochMs: 0
      },
      authEvaluation: {
        decisionId: "auth-X",
        authenticated: true,
        status: "allow",
        principal: {
          tenantId: "tenant-d",
          userId: "user-d",
          agentId: "agent-d",
          effectiveScopes: ["tools:write"]
        },
        failedChecks: [],
        reasonCode: "auth:ok"
      },
      policyEvaluation: {
        decisionId: "pol-X",
        status: "deny",
        applicableRules: [
          {
            ruleId: "deny-1",
            stage: "policy",
            status: "deny",
            reasonCode: "policy:blocked",
            priority: 1
          }
        ],
        transformPatches: [],
        deniedReasonCode: "policy:blocked"
      },
      toolFilterDecision: {
        decisionId: "tool-Y",
        status: "deny",
        allowedTools: [],
        blockedTools: [
          {
            serverId: "server-d",
            toolName: "restricted",
            reasonCode: "tool:not-visible"
          }
        ],
        selectedToolAllowed: false
      },
      rateLimitDecision: {
        decisionId: "rate-Y",
        status: "allow",
        allowed: true,
        retryAfterSeconds: 0,
        appliedRules: []
      },
      redactedRequest: {
        decisionId: "req-Z",
        status: "allow",
        serverId: "server-d",
        toolName: "",
        arguments: {},
        redactionEvents: []
      },
      upstreamExecutionResult: {
        decisionId: "dispatch-Z",
        status: "deny",
        dispatched: false,
        blockedByStage: "policy",
        httpStatusCode: 503,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "down"
          }
        }
      },
      redactedResponse: {
        decisionId: "resp-Z",
        status: "allow",
        responsePayload: {},
        redactionEvents: [],
        containsSensitiveData: true
      },
      traceRecordSet: {
        traceId: "trace-Q",
        spans: [],
        metrics: [],
        exportTarget: "audit-log"
      },
      costMeteringRecord: {
        costRecordId: "cost-Z",
        invocationId: "inv-other",
        lineItems: [],
        totalUsd: 1.23,
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30
        }
      }
    },
    expected: {
      executionReportId: "5deadc69d0e0539f4b8a16f326b02500d4aa25c6589bb784355012d56fd44828",
      invocationId: "inv-4",
      traceId: "trace-4",
      finalStatus: "blocked",
      middlewareDecisions: [
        {
          componentId: "auth-evaluator",
          stage: "authenticate",
          status: "allow",
          reasonCode: "auth:ok",
          decisionId: "auth-X"
        },
        {
          componentId: "cost-meter",
          stage: "cost-meter",
          status: "observe-only",
          reasonCode: "cost:computed",
          decisionId: "cost-Z"
        },
        {
          componentId: "upstream-dispatcher",
          stage: "dispatch",
          status: "deny",
          reasonCode: "dispatch:blocked-by-policy",
          decisionId: "dispatch-Z"
        },
        {
          componentId: "policy-evaluator",
          stage: "policy",
          status: "deny",
          reasonCode: "policy:blocked",
          decisionId: "pol-X"
        },
        {
          componentId: "rate-limit-enforcer",
          stage: "rate-limit",
          status: "allow",
          reasonCode: "rate-limit:allowed",
          decisionId: "rate-Y"
        },
        {
          componentId: "request-redactor",
          stage: "request-redaction",
          status: "allow",
          reasonCode: "request-redaction:none",
          decisionId: "req-Z"
        },
        {
          componentId: "response-redactor",
          stage: "response-redaction",
          status: "allow",
          reasonCode: "response-redaction:none",
          decisionId: "resp-Z"
        },
        {
          componentId: "tool-visibility-filter",
          stage: "tool-filter",
          status: "deny",
          reasonCode: "tool:not-visible",
          decisionId: "tool-Y"
        },
        {
          componentId: "trace-recorder",
          stage: "trace",
          status: "observe-only",
          reasonCode: "audit-log",
          decisionId: "trace-Q"
        }
      ],
      requestSummary: {
        tenantId: "tenant-d",
        userId: "user-d",
        agentId: "agent-d",
        serverId: "server-d",
        toolName: "tool-from-normalized"
      },
      enforcementSummary: {
        authPassed: true,
        policyStatus: "deny",
        rateLimitAllowed: true,
        selectedToolAllowed: false
      },
      observability: {
        spanCount: 0,
        metricCount: 0
      },
      cost: {
        totalUsd: 1.23,
        totalTokens: 30
      },
      response: {
        httpStatusCode: 503,
        dispatched: false,
        containsSensitiveData: true
      }
    }
  }
];
