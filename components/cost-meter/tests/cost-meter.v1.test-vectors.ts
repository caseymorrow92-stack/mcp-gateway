import { costMeter } from "../index";

export type CostMeterInput = Parameters<typeof costMeter>[0];
type CostMeterExpected = ReturnType<typeof costMeter>;

export const TEST_VECTORS: Array<{
  name: string;
  input: CostMeterInput;
  expected: CostMeterExpected;
}> = [
  {
    name: "happy-path computes base plus token charges",
    input: {
      normalizedContext: {
        invocationId: "inv-001",
        traceId: "trace-001",
        normalizedMethod: "tools/call",
        normalizedToolName: "search",
        tenantId: "tenant-a",
        userId: "user-a",
        agentId: "agent-a",
        scopes: ["tool:search"],
        requestPayload: { query: "pricing" },
        requestTokenEstimate: 120,
        responseTokenEstimate: 30,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.00002,
          outputTokenPriceUsd: 0.00004,
          requestBaseFeeUsd: 0.01
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 1700000000000
      },
      upstreamExecution: {
        decisionId: "dec-allow",
        status: "allow",
        dispatched: true,
        httpStatusCode: 200,
        upstreamLatencyMs: 12,
        upstreamResponse: {
          result: { ok: true }
        }
      },
      redactedResponse: {
        decisionId: "resp-001",
        status: "allow",
        responsePayload: { ok: true },
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      costRecordId: "92c4864cfe438a5754fb1b45396e9fbd7adf31a8fced085e138532286ebc1b8c",
      invocationId: "inv-001",
      lineItems: [
        {
          category: "base-request",
          dimensionKey: "inv-001",
          quantity: 1,
          unitPriceUsd: 0.01,
          subtotalUsd: 0.01
        },
        {
          category: "input-tokens",
          dimensionKey: "inv-001",
          quantity: 120,
          unitPriceUsd: 0.00002,
          subtotalUsd: 0.0024000000000000002
        },
        {
          category: "output-tokens",
          dimensionKey: "inv-001",
          quantity: 30,
          unitPriceUsd: 0.00004,
          subtotalUsd: 0.0012
        }
      ],
      totalUsd: 0.0136,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        totalTokens: 150
      }
    }
  },
  {
    name: "zero-token invocation still charges base-request",
    input: {
      normalizedContext: {
        invocationId: "inv-002",
        traceId: "trace-002",
        normalizedMethod: "tools/call",
        normalizedToolName: "echo",
        tenantId: "tenant-a",
        userId: "user-a",
        agentId: "agent-a",
        scopes: [],
        requestPayload: {},
        requestTokenEstimate: 0,
        responseTokenEstimate: 0,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.001,
          outputTokenPriceUsd: 0.001,
          requestBaseFeeUsd: 0.05
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 1700000000000
      },
      upstreamExecution: {
        decisionId: "dec-allow-2",
        status: "allow",
        dispatched: true,
        httpStatusCode: 200,
        upstreamLatencyMs: 1,
        upstreamResponse: { result: {} }
      },
      redactedResponse: {
        decisionId: "resp-002",
        status: "allow",
        responsePayload: {},
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      costRecordId: "2a22c48b8652b3465fa3c3a9db4f05355bca412a007654d5988b4bc77abd4d7c",
      invocationId: "inv-002",
      lineItems: [
        {
          category: "base-request",
          dimensionKey: "inv-002",
          quantity: 1,
          unitPriceUsd: 0.05,
          subtotalUsd: 0.05
        },
        {
          category: "input-tokens",
          dimensionKey: "inv-002",
          quantity: 0,
          unitPriceUsd: 0.001,
          subtotalUsd: 0
        },
        {
          category: "output-tokens",
          dimensionKey: "inv-002",
          quantity: 0,
          unitPriceUsd: 0.001,
          subtotalUsd: 0
        }
      ],
      totalUsd: 0.05,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    }
  },
  {
    name: "denied upstream forces output token quantity to zero",
    input: {
      normalizedContext: {
        invocationId: "inv-003",
        traceId: "trace-003",
        normalizedMethod: "tools/call",
        normalizedToolName: "restricted",
        tenantId: "tenant-b",
        userId: "user-b",
        agentId: "agent-b",
        scopes: ["tool:restricted"],
        requestPayload: { value: 1 },
        requestTokenEstimate: 50,
        responseTokenEstimate: 999,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.0001,
          outputTokenPriceUsd: 0.0002,
          requestBaseFeeUsd: 0.005
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 1700000000000
      },
      upstreamExecution: {
        decisionId: "dec-deny",
        status: "deny",
        dispatched: false,
        blockedByStage: "policy",
        httpStatusCode: 403,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          error: { code: "forbidden", message: "Denied" }
        }
      },
      redactedResponse: {
        decisionId: "resp-003",
        status: "deny",
        responsePayload: {},
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      costRecordId: "882c16900f77a5f59aa5ccf946be8670f60a5b7f860bb5abb201419ac295137d",
      invocationId: "inv-003",
      lineItems: [
        {
          category: "base-request",
          dimensionKey: "inv-003",
          quantity: 1,
          unitPriceUsd: 0.005,
          subtotalUsd: 0.005
        },
        {
          category: "input-tokens",
          dimensionKey: "inv-003",
          quantity: 50,
          unitPriceUsd: 0.0001,
          subtotalUsd: 0.005
        },
        {
          category: "output-tokens",
          dimensionKey: "inv-003",
          quantity: 0,
          unitPriceUsd: 0.0002,
          subtotalUsd: 0
        }
      ],
      totalUsd: 0.01,
      usage: {
        inputTokens: 50,
        outputTokens: 0,
        totalTokens: 50
      }
    }
  },
  {
    name: "negative token estimates clamp to zero before pricing",
    input: {
      normalizedContext: {
        invocationId: "inv-004",
        traceId: "trace-004",
        normalizedMethod: "tools/call",
        normalizedToolName: "calc",
        tenantId: "tenant-c",
        userId: "user-c",
        agentId: "agent-c",
        scopes: [],
        requestPayload: {},
        requestTokenEstimate: -10,
        responseTokenEstimate: -20,
        policyRules: [],
        rateLimitRules: [],
        toolCatalog: [],
        redactionRules: [],
        pricing: {
          inputTokenPriceUsd: 0.2,
          outputTokenPriceUsd: 0.3,
          requestBaseFeeUsd: 0.1
        },
        historicalCallsInWindow: {},
        windowStartEpochMs: 1700000000000
      },
      upstreamExecution: {
        decisionId: "dec-allow-4",
        status: "allow",
        dispatched: true,
        httpStatusCode: 200,
        upstreamLatencyMs: 7,
        upstreamResponse: {
          result: { ok: true }
        }
      },
      redactedResponse: {
        decisionId: "resp-004",
        status: "allow",
        responsePayload: { ok: true },
        redactionEvents: [],
        containsSensitiveData: false
      }
    },
    expected: {
      costRecordId: "3a9763cc04e6c0626c286ed9cdb64a088192e14155d2db646ea7d9dd34704aa6",
      invocationId: "inv-004",
      lineItems: [
        {
          category: "base-request",
          dimensionKey: "inv-004",
          quantity: 1,
          unitPriceUsd: 0.1,
          subtotalUsd: 0.1
        },
        {
          category: "input-tokens",
          dimensionKey: "inv-004",
          quantity: 0,
          unitPriceUsd: 0.2,
          subtotalUsd: 0
        },
        {
          category: "output-tokens",
          dimensionKey: "inv-004",
          quantity: 0,
          unitPriceUsd: 0.3,
          subtotalUsd: 0
        }
      ],
      totalUsd: 0.1,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    }
  }
];
