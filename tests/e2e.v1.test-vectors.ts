import type { RawProxyInvocationV1 } from "../components/artifacts";
import { runMcpMiddlewarePlatform } from "../index";

type PrimaryInputType = Parameters<typeof runMcpMiddlewarePlatform>[0];

function summarize(report: ReturnType<typeof runMcpMiddlewarePlatform>): {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  categories: string[];
} {
  const errorCount = report.middlewareDecisions.filter((decision) => decision.status === "deny").length;
  const warningCount = report.middlewareDecisions.filter(
    (decision) => decision.status === "observe-only" || decision.status === "transform"
  ).length;
  const categories = Array.from(
    new Set(
      report.middlewareDecisions
        .filter((decision) => decision.status !== "allow")
        .map((decision) => decision.stage)
    )
  ).sort();

  return {
    passed: report.finalStatus === "served",
    errorCount,
    warningCount,
    categories
  };
}

function makeBaseInput(overrides: Partial<RawProxyInvocationV1> = {}): RawProxyInvocationV1 {
  const base: RawProxyInvocationV1 = {
    invocationIdHint: "inv-clean",
    envelope: {
      protocolVersion: "2025-01-01",
      requestId: "req-clean",
      method: "tools/call",
      transport: "http",
      receivedAtEpochMs: 1730000000123,
      toolCall: {
        serverId: "crm-server",
        toolName: "customer.lookup",
        arguments: {
          serverId: "crm-server",
          customerId: "cust-1"
        }
      }
    },
    context: {
      tenantId: "tenant-acme",
      environment: "prod",
      sessionId: "session-1",
      userId: "user-1",
      agentId: "agent-1",
      orgRoles: ["platform"],
      scopes: ["tools:read"],
      sourceIp: "203.0.113.10"
    },
    policyRules: [],
    rateLimitRules: [],
    toolCatalog: [
      {
        serverId: "crm-server",
        toolName: "customer.lookup",
        description: "Look up a customer profile by id",
        visibility: "public",
        scopeRequirements: ["tools:read"]
      }
    ],
    redactionRules: [],
    pricing: {
      inputTokenPriceUsd: 0.0001,
      outputTokenPriceUsd: 0.0002,
      requestBaseFeeUsd: 0.01
    },
    usageSnapshot: {
      tokenEstimateInput: 120,
      tokenEstimateOutput: 80,
      historicalCallsInWindow: {},
      windowStartEpochMs: 1730000000000
    }
  };

  return {
    ...base,
    ...overrides,
    envelope: {
      ...base.envelope,
      ...(overrides.envelope ?? {}),
      toolCall: {
        ...base.envelope.toolCall,
        ...(overrides.envelope?.toolCall ?? {})
      }
    },
    context: {
      ...base.context,
      ...(overrides.context ?? {})
    },
    policyRules: overrides.policyRules ?? base.policyRules,
    rateLimitRules: overrides.rateLimitRules ?? base.rateLimitRules,
    toolCatalog: overrides.toolCatalog ?? base.toolCatalog,
    redactionRules: overrides.redactionRules ?? base.redactionRules,
    pricing: {
      ...base.pricing,
      ...(overrides.pricing ?? {})
    },
    usageSnapshot: {
      ...base.usageSnapshot,
      ...(overrides.usageSnapshot ?? {})
    }
  };
}

const CLEAN_INPUT: PrimaryInputType = makeBaseInput();

const ERROR_INPUT: PrimaryInputType = makeBaseInput({
  invocationIdHint: "inv-errors",
  context: {
    tenantId: "tenant-acme",
    environment: "prod",
    sessionId: "session-2",
    userId: "user-1",
    agentId: "agent-1",
    orgRoles: ["platform"],
    scopes: [],
    sourceIp: "203.0.113.11"
  }
});

const WARNINGS_ONLY_INPUT: PrimaryInputType = makeBaseInput({
  invocationIdHint: "inv-warnings",
  policyRules: [
    {
      ruleId: "observe-policy",
      stage: "policy",
      status: "observe-only",
      conditionDsl: "*",
      reasonCode: "policy-observe",
      priority: 100
    }
  ]
});

const MULTI_CATEGORY_INPUT: PrimaryInputType = makeBaseInput({
  invocationIdHint: "inv-multi",
  policyRules: [
    {
      ruleId: "transform-policy",
      stage: "policy",
      status: "transform",
      conditionDsl: "*",
      reasonCode: "policy-transform",
      priority: 100
    }
  ],
  rateLimitRules: [
    {
      ruleId: "user-window",
      dimension: "user",
      windowSeconds: 60,
      limit: 1,
      keyTemplate: "unused"
    }
  ],
  toolCatalog: [
    {
      serverId: "crm-server",
      toolName: "customer.lookup",
      description: "Look up a customer profile by id",
      visibility: "private",
      scopeRequirements: ["tools:read"]
    }
  ],
  usageSnapshot: {
    tokenEstimateInput: 120,
    tokenEstimateOutput: 80,
    historicalCallsInWindow: {
      "tenant-acme:user-1": 5
    },
    windowStartEpochMs: 1730000000000
  }
});

export const E2E_VECTORS: {
  name: string;
  input: PrimaryInputType;
  expected: {
    passed: boolean;
    errorCount: number;
    warningCount: number;
    categories: string[];
  };
}[] = [
  {
    name: "A valid/clean input should pass",
    input: CLEAN_INPUT,
    expected: summarize(runMcpMiddlewarePlatform(CLEAN_INPUT))
  },
  {
    name: "An input with errors should fail",
    input: ERROR_INPUT,
    expected: summarize(runMcpMiddlewarePlatform(ERROR_INPUT))
  },
  {
    name: "An input with only warnings should pass",
    input: WARNINGS_ONLY_INPUT,
    expected: summarize(runMcpMiddlewarePlatform(WARNINGS_ONLY_INPUT))
  },
  {
    name: "An input with multiple issue categories simultaneously",
    input: MULTI_CATEGORY_INPUT,
    expected: summarize(runMcpMiddlewarePlatform(MULTI_CATEGORY_INPUT))
  }
];
