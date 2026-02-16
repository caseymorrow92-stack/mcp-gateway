import type { ProgramContract } from "../../contracts/program-contract.types";

export type ArtifactId =
  | "ProxyProcessSpawnRequestV1"
  | "ProxyProcessSpawnDecisionV1"
  | "RawProxyInvocationV1"
  | "NormalizedProxyContextV1"
  | "AuthEvaluationV1"
  | "PolicyEvaluationV1"
  | "ToolFilterDecisionV1"
  | "RateLimitDecisionV1"
  | "RedactedRequestV1"
  | "UpstreamExecutionResultV1"
  | "RedactedResponseV1"
  | "TraceRecordSetV1"
  | "CostMeteringRecordV1"
  | "MiddlewareExecutionReportV1";

export type ComponentId =
  | "proxy-process-governor"
  | "request-normalizer"
  | "auth-evaluator"
  | "policy-evaluator"
  | "tool-visibility-filter"
  | "rate-limit-enforcer"
  | "request-redactor"
  | "upstream-dispatcher"
  | "response-redactor"
  | "trace-recorder"
  | "cost-meter"
  | "exchange-assembler";

export const PROGRAM_CONTRACT = {
  version: "v1",

  economicTarget: {
    buyer: "enterprise-security-and-platform-teams",
    acquisitionChannels: ["direct-sales", "developer-community"],
    primaryPurchaseTriggers: [
      "soc2-audit",
      "eu-ai-act-compliance",
      "agent-deployment-freeze",
      "open-source-adoption"
    ],
    paymentModel: "subscription",
    starterPriceUsdMonthly: 99,
    proPriceUsdMonthly: 499,
    enterpriseTier: "custom-pricing"
  },

  components: [
    {
      id: "proxy-process-governor",
      inputs: ["ProxyProcessSpawnRequestV1"],
      outputs: ["ProxyProcessSpawnDecisionV1"],
      deterministic: true
    },
    {
      id: "request-normalizer",
      inputs: ["RawProxyInvocationV1"],
      outputs: ["NormalizedProxyContextV1"],
      deterministic: true
    },
    {
      id: "auth-evaluator",
      inputs: ["NormalizedProxyContextV1"],
      outputs: ["AuthEvaluationV1"],
      deterministic: true
    },
    {
      id: "policy-evaluator",
      inputs: ["NormalizedProxyContextV1", "AuthEvaluationV1"],
      outputs: ["PolicyEvaluationV1"],
      deterministic: true
    },
    {
      id: "tool-visibility-filter",
      inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1"],
      outputs: ["ToolFilterDecisionV1"],
      deterministic: true
    },
    {
      id: "rate-limit-enforcer",
      inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1"],
      outputs: ["RateLimitDecisionV1"],
      deterministic: true
    },
    {
      id: "request-redactor",
      inputs: ["NormalizedProxyContextV1", "PolicyEvaluationV1", "ToolFilterDecisionV1"],
      outputs: ["RedactedRequestV1"],
      deterministic: true
    },
    {
      id: "upstream-dispatcher",
      inputs: ["NormalizedProxyContextV1", "AuthEvaluationV1", "PolicyEvaluationV1", "RateLimitDecisionV1", "RedactedRequestV1"],
      outputs: ["UpstreamExecutionResultV1"],
      deterministic: true
    },
    {
      id: "response-redactor",
      inputs: ["PolicyEvaluationV1", "UpstreamExecutionResultV1"],
      outputs: ["RedactedResponseV1"],
      deterministic: true
    },
    {
      id: "trace-recorder",
      inputs: [
        "NormalizedProxyContextV1",
        "AuthEvaluationV1",
        "PolicyEvaluationV1",
        "RateLimitDecisionV1",
        "UpstreamExecutionResultV1",
        "RedactedResponseV1"
      ],
      outputs: ["TraceRecordSetV1"],
      deterministic: true
    },
    {
      id: "cost-meter",
      inputs: ["NormalizedProxyContextV1", "UpstreamExecutionResultV1", "RedactedResponseV1"],
      outputs: ["CostMeteringRecordV1"],
      deterministic: true
    },
    {
      id: "exchange-assembler",
      inputs: [
        "NormalizedProxyContextV1",
        "AuthEvaluationV1",
        "PolicyEvaluationV1",
        "ToolFilterDecisionV1",
        "RateLimitDecisionV1",
        "RedactedRequestV1",
        "UpstreamExecutionResultV1",
        "RedactedResponseV1",
        "TraceRecordSetV1",
        "CostMeteringRecordV1"
      ],
      outputs: ["MiddlewareExecutionReportV1"],
      deterministic: true
    }
  ],

  pipeline: {
    order: [
      "proxy-process-governor",
      "request-normalizer",
      "auth-evaluator",
      "policy-evaluator",
      "tool-visibility-filter",
      "rate-limit-enforcer",
      "request-redactor",
      "upstream-dispatcher",
      "response-redactor",
      "trace-recorder",
      "cost-meter",
      "exchange-assembler"
    ],
    edges: [
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "auth-evaluator",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "policy-evaluator",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "tool-visibility-filter",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "rate-limit-enforcer",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "request-redactor",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "upstream-dispatcher",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "trace-recorder",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "cost-meter",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "request-normalizer",
        fromArtifact: "NormalizedProxyContextV1",
        toComponent: "exchange-assembler",
        toArtifact: "NormalizedProxyContextV1"
      },
      {
        fromComponent: "auth-evaluator",
        fromArtifact: "AuthEvaluationV1",
        toComponent: "policy-evaluator",
        toArtifact: "AuthEvaluationV1"
      },
      {
        fromComponent: "auth-evaluator",
        fromArtifact: "AuthEvaluationV1",
        toComponent: "upstream-dispatcher",
        toArtifact: "AuthEvaluationV1"
      },
      {
        fromComponent: "auth-evaluator",
        fromArtifact: "AuthEvaluationV1",
        toComponent: "trace-recorder",
        toArtifact: "AuthEvaluationV1"
      },
      {
        fromComponent: "auth-evaluator",
        fromArtifact: "AuthEvaluationV1",
        toComponent: "exchange-assembler",
        toArtifact: "AuthEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "tool-visibility-filter",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "rate-limit-enforcer",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "request-redactor",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "upstream-dispatcher",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "response-redactor",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "trace-recorder",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "policy-evaluator",
        fromArtifact: "PolicyEvaluationV1",
        toComponent: "exchange-assembler",
        toArtifact: "PolicyEvaluationV1"
      },
      {
        fromComponent: "tool-visibility-filter",
        fromArtifact: "ToolFilterDecisionV1",
        toComponent: "request-redactor",
        toArtifact: "ToolFilterDecisionV1"
      },
      {
        fromComponent: "tool-visibility-filter",
        fromArtifact: "ToolFilterDecisionV1",
        toComponent: "exchange-assembler",
        toArtifact: "ToolFilterDecisionV1"
      },
      {
        fromComponent: "rate-limit-enforcer",
        fromArtifact: "RateLimitDecisionV1",
        toComponent: "upstream-dispatcher",
        toArtifact: "RateLimitDecisionV1"
      },
      {
        fromComponent: "rate-limit-enforcer",
        fromArtifact: "RateLimitDecisionV1",
        toComponent: "trace-recorder",
        toArtifact: "RateLimitDecisionV1"
      },
      {
        fromComponent: "rate-limit-enforcer",
        fromArtifact: "RateLimitDecisionV1",
        toComponent: "exchange-assembler",
        toArtifact: "RateLimitDecisionV1"
      },
      {
        fromComponent: "request-redactor",
        fromArtifact: "RedactedRequestV1",
        toComponent: "upstream-dispatcher",
        toArtifact: "RedactedRequestV1"
      },
      {
        fromComponent: "request-redactor",
        fromArtifact: "RedactedRequestV1",
        toComponent: "exchange-assembler",
        toArtifact: "RedactedRequestV1"
      },
      {
        fromComponent: "upstream-dispatcher",
        fromArtifact: "UpstreamExecutionResultV1",
        toComponent: "response-redactor",
        toArtifact: "UpstreamExecutionResultV1"
      },
      {
        fromComponent: "upstream-dispatcher",
        fromArtifact: "UpstreamExecutionResultV1",
        toComponent: "trace-recorder",
        toArtifact: "UpstreamExecutionResultV1"
      },
      {
        fromComponent: "upstream-dispatcher",
        fromArtifact: "UpstreamExecutionResultV1",
        toComponent: "cost-meter",
        toArtifact: "UpstreamExecutionResultV1"
      },
      {
        fromComponent: "upstream-dispatcher",
        fromArtifact: "UpstreamExecutionResultV1",
        toComponent: "exchange-assembler",
        toArtifact: "UpstreamExecutionResultV1"
      },
      {
        fromComponent: "response-redactor",
        fromArtifact: "RedactedResponseV1",
        toComponent: "trace-recorder",
        toArtifact: "RedactedResponseV1"
      },
      {
        fromComponent: "response-redactor",
        fromArtifact: "RedactedResponseV1",
        toComponent: "cost-meter",
        toArtifact: "RedactedResponseV1"
      },
      {
        fromComponent: "response-redactor",
        fromArtifact: "RedactedResponseV1",
        toComponent: "exchange-assembler",
        toArtifact: "RedactedResponseV1"
      },
      {
        fromComponent: "trace-recorder",
        fromArtifact: "TraceRecordSetV1",
        toComponent: "exchange-assembler",
        toArtifact: "TraceRecordSetV1"
      },
      {
        fromComponent: "cost-meter",
        fromArtifact: "CostMeteringRecordV1",
        toComponent: "exchange-assembler",
        toArtifact: "CostMeteringRecordV1"
      }
    ]
  },

  determinism: {
    disallowNondeterministicSources: ["time", "random", "network", "process-global-state"],
    numericPolicy: {
      tokenRounding: "integers-only",
      currencyScale: 4,
      currencyRoundingMode: "half-even",
      rateLimitMath: "fixed-window with deterministic windowStartEpochMs from input"
    },
    canonicalArrayOrder: {
      "ToolFilterDecisionV1.allowedTools": ["serverId:asc", "toolName:asc"],
      "ToolFilterDecisionV1.blockedTools": ["reasonCode:asc", "serverId:asc", "toolName:asc"],
      "RateLimitDecisionV1.appliedRules": ["dimension:asc", "windowSeconds:asc", "limit:asc"],
      "RedactedRequestV1.redactionEvents": ["locationPath:asc", "ruleId:asc"],
      "RedactedResponseV1.redactionEvents": ["locationPath:asc", "ruleId:asc"],
      "TraceRecordSetV1.spans": ["spanKind:asc", "spanName:asc"],
      "CostMeteringRecordV1.lineItems": ["category:asc", "dimensionKey:asc"],
      "MiddlewareExecutionReportV1.middlewareDecisions": ["stage:asc", "status:asc"]
    },
    idDerivation: {
      invocationId: "sha256(canonical-json(rawInvocation.envelope + rawInvocation.context))",
      decisionId: "sha256(componentId + stage + status + reasonCode)",
      proxyProcessDecisionId: "sha256(proxyCommand + allowedPrefixes + restartPolicy)",
      spanId: "sha256(traceId + spanKind + spanName + ordinal)",
      executionReportId: "sha256(invocationId + policyDecisionId + rateLimitDecisionId + costRecordId)"
    }
  },

  testManifest: {
    requiredSuites: [
      "tests/program-contract.v1.test.ts",
      "components/proxy-process-governor/tests/proxy-process-governor.v1.test-vectors.ts",
      "components/request-normalizer/tests/request-normalizer.v1.test-vectors.ts",
      "components/auth-evaluator/tests/auth-evaluator.v1.test-vectors.ts",
      "components/policy-evaluator/tests/policy-evaluator.v1.test-vectors.ts",
      "components/tool-visibility-filter/tests/tool-visibility-filter.v1.test-vectors.ts",
      "components/rate-limit-enforcer/tests/rate-limit-enforcer.v1.test-vectors.ts",
      "components/request-redactor/tests/request-redactor.v1.test-vectors.ts",
      "components/upstream-dispatcher/tests/upstream-dispatcher.v1.test-vectors.ts",
      "components/response-redactor/tests/response-redactor.v1.test-vectors.ts",
      "components/trace-recorder/tests/trace-recorder.v1.test-vectors.ts",
      "components/cost-meter/tests/cost-meter.v1.test-vectors.ts",
      "components/exchange-assembler/tests/exchange-assembler.v1.test-vectors.ts",
      "tests/e2e.v1.test-vectors.ts"
    ]
  }
} as const satisfies ProgramContract<ArtifactId, ComponentId>;
