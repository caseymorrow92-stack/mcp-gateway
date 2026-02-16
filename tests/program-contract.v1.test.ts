import type {
  AuthEvaluationV1,
  CostMeteringRecordV1,
  MiddlewareExecutionReportV1,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  ProxyProcessSpawnDecisionV1,
  ProxyProcessSpawnRequestV1,
  RateLimitDecisionV1,
  RawProxyInvocationV1,
  RedactedRequestV1,
  RedactedResponseV1,
  ToolFilterDecisionV1,
  TraceRecordSetV1,
  UpstreamExecutionResultV1
} from "../components/artifacts";
import { evaluateAuth } from "../components/auth-evaluator";
import { COMPONENT_CONTRACT as AUTH_EVALUATOR_CONTRACT } from "../components/auth-evaluator/contract";
import { costMeter } from "../components/cost-meter";
import { COMPONENT_CONTRACT as COST_METER_CONTRACT } from "../components/cost-meter/contract";
import { assembleExchange } from "../components/exchange-assembler";
import { COMPONENT_CONTRACT as EXCHANGE_ASSEMBLER_CONTRACT } from "../components/exchange-assembler/contract";
import { evaluatePolicy } from "../components/policy-evaluator";
import { COMPONENT_CONTRACT as POLICY_EVALUATOR_CONTRACT } from "../components/policy-evaluator/contract";
import { evaluateProxyProcessSpawn } from "../components/proxy-process-governor";
import { COMPONENT_CONTRACT as PROXY_PROCESS_GOVERNOR_CONTRACT } from "../components/proxy-process-governor/contract";
import { enforceRateLimit } from "../components/rate-limit-enforcer";
import { COMPONENT_CONTRACT as RATE_LIMIT_ENFORCER_CONTRACT } from "../components/rate-limit-enforcer/contract";
import { normalizeRequest } from "../components/request-normalizer";
import { COMPONENT_CONTRACT as REQUEST_NORMALIZER_CONTRACT } from "../components/request-normalizer/contract";
import { redactRequest } from "../components/request-redactor";
import { COMPONENT_CONTRACT as REQUEST_REDACTOR_CONTRACT } from "../components/request-redactor/contract";
import { redactResponse } from "../components/response-redactor";
import { COMPONENT_CONTRACT as RESPONSE_REDACTOR_CONTRACT } from "../components/response-redactor/contract";
import { toolVisibilityFilter } from "../components/tool-visibility-filter";
import { COMPONENT_CONTRACT as TOOL_VISIBILITY_FILTER_CONTRACT } from "../components/tool-visibility-filter/contract";
import { recordTrace } from "../components/trace-recorder";
import { COMPONENT_CONTRACT as TRACE_RECORDER_CONTRACT } from "../components/trace-recorder/contract";
import { dispatchUpstream } from "../components/upstream-dispatcher";
import { COMPONENT_CONTRACT as UPSTREAM_DISPATCHER_CONTRACT } from "../components/upstream-dispatcher/contract";
import { runMcpMiddlewarePlatform } from "../index";
import type { ComponentId } from "../program.contract";
import { PROGRAM_CONTRACT } from "../program.contract";

const normalizeRequestInputForward: RawProxyInvocationV1 = {} as Parameters<typeof normalizeRequest>[0];
const normalizeRequestInputBackward: Parameters<typeof normalizeRequest>[0] = {} as RawProxyInvocationV1;
const normalizeRequestOutputForward: NormalizedProxyContextV1 = {} as ReturnType<typeof normalizeRequest>;
const normalizeRequestOutputBackward: ReturnType<typeof normalizeRequest> = {} as NormalizedProxyContextV1;

const evaluateAuthInputForward: NormalizedProxyContextV1 = {} as Parameters<typeof evaluateAuth>[0];
const evaluateAuthInputBackward: Parameters<typeof evaluateAuth>[0] = {} as NormalizedProxyContextV1;
const evaluateAuthOutputForward: AuthEvaluationV1 = {} as ReturnType<typeof evaluateAuth>;
const evaluateAuthOutputBackward: ReturnType<typeof evaluateAuth> = {} as AuthEvaluationV1;

const evaluatePolicyInputShape: Parameters<typeof evaluatePolicy> extends [NormalizedProxyContextV1, AuthEvaluationV1]
  ? true
  : false = true;
const evaluatePolicyOutputForward: PolicyEvaluationV1 = {} as ReturnType<typeof evaluatePolicy>;
const evaluatePolicyOutputBackward: ReturnType<typeof evaluatePolicy> = {} as PolicyEvaluationV1;

const toolVisibilityFilterInputShape: Parameters<typeof toolVisibilityFilter> extends [
  NormalizedProxyContextV1,
  PolicyEvaluationV1
]
  ? true
  : false = true;
const toolVisibilityFilterOutputForward: ToolFilterDecisionV1 = {} as ReturnType<typeof toolVisibilityFilter>;
const toolVisibilityFilterOutputBackward: ReturnType<typeof toolVisibilityFilter> = {} as ToolFilterDecisionV1;

const rateLimitEnforcerInputShape: Parameters<typeof enforceRateLimit> extends [
  NormalizedProxyContextV1,
  PolicyEvaluationV1
]
  ? true
  : false = true;
const rateLimitEnforcerOutputForward: RateLimitDecisionV1 = {} as ReturnType<typeof enforceRateLimit>;
const rateLimitEnforcerOutputBackward: ReturnType<typeof enforceRateLimit> = {} as RateLimitDecisionV1;

const requestRedactorInputShape: Parameters<typeof redactRequest>[0] extends {
  normalizedContext: NormalizedProxyContextV1;
  policyEvaluation: PolicyEvaluationV1;
  toolFilterDecision: ToolFilterDecisionV1;
}
  ? true
  : false = true;
const requestRedactorOutputForward: RedactedRequestV1 = {} as ReturnType<typeof redactRequest>;
const requestRedactorOutputBackward: ReturnType<typeof redactRequest> = {} as RedactedRequestV1;

const upstreamDispatcherInputShape: Parameters<typeof dispatchUpstream>[0] extends {
  normalizedContext: NormalizedProxyContextV1;
  authEvaluation: AuthEvaluationV1;
  policyEvaluation: PolicyEvaluationV1;
  rateLimitDecision: RateLimitDecisionV1;
  redactedRequest: RedactedRequestV1;
}
  ? true
  : false = true;
const upstreamDispatcherOutputForward: UpstreamExecutionResultV1 = {} as ReturnType<typeof dispatchUpstream>;
const upstreamDispatcherOutputBackward: ReturnType<typeof dispatchUpstream> = {} as UpstreamExecutionResultV1;

const responseRedactorInputShape: Parameters<typeof redactResponse> extends [PolicyEvaluationV1, UpstreamExecutionResultV1]
  ? true
  : false = true;
const responseRedactorOutputForward: RedactedResponseV1 = {} as ReturnType<typeof redactResponse>;
const responseRedactorOutputBackward: ReturnType<typeof redactResponse> = {} as RedactedResponseV1;

const traceRecorderInputShape: Parameters<typeof recordTrace>[0] extends {
  normalizedContext: NormalizedProxyContextV1;
  authEvaluation: AuthEvaluationV1;
  policyEvaluation: PolicyEvaluationV1;
  rateLimitDecision: RateLimitDecisionV1;
  upstreamExecutionResult: UpstreamExecutionResultV1;
  redactedResponse: RedactedResponseV1;
}
  ? true
  : false = true;
const traceRecorderOutputForward: TraceRecordSetV1 = {} as ReturnType<typeof recordTrace>;
const traceRecorderOutputBackward: ReturnType<typeof recordTrace> = {} as TraceRecordSetV1;

const costMeterInputShape: Parameters<typeof costMeter>[0] extends {
  normalizedContext: NormalizedProxyContextV1;
  upstreamExecution: UpstreamExecutionResultV1;
  redactedResponse: RedactedResponseV1;
}
  ? true
  : false = true;
const costMeterOutputForward: CostMeteringRecordV1 = {} as ReturnType<typeof costMeter>;
const costMeterOutputBackward: ReturnType<typeof costMeter> = {} as CostMeteringRecordV1;

const exchangeAssemblerInputShape: Parameters<typeof assembleExchange>[0] extends {
  normalizedContext: NormalizedProxyContextV1;
  authEvaluation: AuthEvaluationV1;
  policyEvaluation: PolicyEvaluationV1;
  toolFilterDecision: ToolFilterDecisionV1;
  rateLimitDecision: RateLimitDecisionV1;
  redactedRequest: RedactedRequestV1;
  upstreamExecutionResult: UpstreamExecutionResultV1;
  redactedResponse: RedactedResponseV1;
  traceRecordSet: TraceRecordSetV1;
  costMeteringRecord: CostMeteringRecordV1;
}
  ? true
  : false = true;
const exchangeAssemblerOutputForward: MiddlewareExecutionReportV1 = {} as ReturnType<typeof assembleExchange>;
const exchangeAssemblerOutputBackward: ReturnType<typeof assembleExchange> = {} as MiddlewareExecutionReportV1;

const proxyProcessGovernorInputForward: ProxyProcessSpawnRequestV1 = {} as Parameters<typeof evaluateProxyProcessSpawn>[0];
const proxyProcessGovernorInputBackward: Parameters<typeof evaluateProxyProcessSpawn>[0] = {} as ProxyProcessSpawnRequestV1;
const proxyProcessGovernorOutputForward: ProxyProcessSpawnDecisionV1 = {} as ReturnType<typeof evaluateProxyProcessSpawn>;
const proxyProcessGovernorOutputBackward: ReturnType<typeof evaluateProxyProcessSpawn> = {} as ProxyProcessSpawnDecisionV1;

void normalizeRequestInputForward;
void normalizeRequestInputBackward;
void normalizeRequestOutputForward;
void normalizeRequestOutputBackward;
void evaluateAuthInputForward;
void evaluateAuthInputBackward;
void evaluateAuthOutputForward;
void evaluateAuthOutputBackward;
void evaluatePolicyInputShape;
void evaluatePolicyOutputForward;
void evaluatePolicyOutputBackward;
void toolVisibilityFilterInputShape;
void toolVisibilityFilterOutputForward;
void toolVisibilityFilterOutputBackward;
void rateLimitEnforcerInputShape;
void rateLimitEnforcerOutputForward;
void rateLimitEnforcerOutputBackward;
void requestRedactorInputShape;
void requestRedactorOutputForward;
void requestRedactorOutputBackward;
void upstreamDispatcherInputShape;
void upstreamDispatcherOutputForward;
void upstreamDispatcherOutputBackward;
void responseRedactorInputShape;
void responseRedactorOutputForward;
void responseRedactorOutputBackward;
void traceRecorderInputShape;
void traceRecorderOutputForward;
void traceRecorderOutputBackward;
void costMeterInputShape;
void costMeterOutputForward;
void costMeterOutputBackward;
void exchangeAssemblerInputShape;
void exchangeAssemblerOutputForward;
void exchangeAssemblerOutputBackward;
void proxyProcessGovernorInputForward;
void proxyProcessGovernorInputBackward;
void proxyProcessGovernorOutputForward;
void proxyProcessGovernorOutputBackward;

const EXPECTED_PIPELINE_ORDER = [
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
] as const satisfies readonly ComponentId[];

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return sameOrder(left, right);
}

const DETERMINISM_INPUT: RawProxyInvocationV1 = {
  invocationIdHint: "determinism-invocation",
  envelope: {
    protocolVersion: "2025-01-01",
    requestId: "determinism-req",
    method: "tools/call",
    transport: "http",
    receivedAtEpochMs: 1730000000123,
    toolCall: {
      serverId: "crm-server",
      toolName: "customer.lookup",
      arguments: {
        serverId: "crm-server",
        customerId: "cust-1",
        internalNotes: "sensitive",
        secret: "token"
      }
    }
  },
  context: {
    tenantId: "tenant-acme",
    environment: "prod",
    sessionId: "session-determinism",
    userId: "user-1",
    agentId: "agent-1",
    orgRoles: ["platform"],
    scopes: ["tools:read"],
    sourceIp: "203.0.113.10"
  },
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

const runOne = runMcpMiddlewarePlatform(DETERMINISM_INPUT);
const runTwo = runMcpMiddlewarePlatform(DETERMINISM_INPUT);

export const PROGRAM_CONTRACT_TEST_V1 = {
  suite: "program-contract.v1",
  checks: [
    {
      id: "pipeline-order-matches-contract",
      pass: sameOrder(PROGRAM_CONTRACT.pipeline.order, EXPECTED_PIPELINE_ORDER)
    },
    {
      id: "proxy-process-governor-signature-matches-contract",
      pass:
        PROXY_PROCESS_GOVERNOR_CONTRACT.id === "proxy-process-governor"
        && sameValues(PROXY_PROCESS_GOVERNOR_CONTRACT.inputs, ["ProxyProcessSpawnRequestV1"])
        && sameValues(PROXY_PROCESS_GOVERNOR_CONTRACT.outputs, ["ProxyProcessSpawnDecisionV1"])
    },
    {
      id: "request-normalizer-signature-matches-contract",
      pass:
        REQUEST_NORMALIZER_CONTRACT.id === "request-normalizer"
        && sameValues(REQUEST_NORMALIZER_CONTRACT.inputs, ["RawProxyInvocationV1"])
        && sameValues(REQUEST_NORMALIZER_CONTRACT.outputs, ["NormalizedProxyContextV1"])
    },
    {
      id: "auth-evaluator-signature-matches-contract",
      pass:
        AUTH_EVALUATOR_CONTRACT.id === "auth-evaluator"
        && sameValues(AUTH_EVALUATOR_CONTRACT.inputs, ["NormalizedProxyContextV1"])
        && sameValues(AUTH_EVALUATOR_CONTRACT.outputs, ["AuthEvaluationV1"])
    },
    {
      id: "policy-evaluator-signature-matches-contract",
      pass:
        POLICY_EVALUATOR_CONTRACT.id === "policy-evaluator"
        && sameValues(POLICY_EVALUATOR_CONTRACT.inputs, ["NormalizedProxyContextV1", "AuthEvaluationV1"])
        && sameValues(POLICY_EVALUATOR_CONTRACT.outputs, ["PolicyEvaluationV1"])
    },
    {
      id: "tool-visibility-filter-signature-matches-contract",
      pass:
        TOOL_VISIBILITY_FILTER_CONTRACT.id === "tool-visibility-filter"
        && sameValues(TOOL_VISIBILITY_FILTER_CONTRACT.inputs, ["NormalizedProxyContextV1", "PolicyEvaluationV1"])
        && sameValues(TOOL_VISIBILITY_FILTER_CONTRACT.outputs, ["ToolFilterDecisionV1"])
    },
    {
      id: "rate-limit-enforcer-signature-matches-contract",
      pass:
        RATE_LIMIT_ENFORCER_CONTRACT.id === "rate-limit-enforcer"
        && sameValues(RATE_LIMIT_ENFORCER_CONTRACT.inputs, ["NormalizedProxyContextV1", "PolicyEvaluationV1"])
        && sameValues(RATE_LIMIT_ENFORCER_CONTRACT.outputs, ["RateLimitDecisionV1"])
    },
    {
      id: "request-redactor-signature-matches-contract",
      pass:
        REQUEST_REDACTOR_CONTRACT.id === "request-redactor"
        && sameValues(REQUEST_REDACTOR_CONTRACT.inputs, [
          "NormalizedProxyContextV1",
          "PolicyEvaluationV1",
          "ToolFilterDecisionV1"
        ])
        && sameValues(REQUEST_REDACTOR_CONTRACT.outputs, ["RedactedRequestV1"])
    },
    {
      id: "upstream-dispatcher-signature-matches-contract",
      pass:
        UPSTREAM_DISPATCHER_CONTRACT.id === "upstream-dispatcher"
        && sameValues(UPSTREAM_DISPATCHER_CONTRACT.inputs, [
          "NormalizedProxyContextV1",
          "AuthEvaluationV1",
          "PolicyEvaluationV1",
          "RateLimitDecisionV1",
          "RedactedRequestV1"
        ])
        && sameValues(UPSTREAM_DISPATCHER_CONTRACT.outputs, ["UpstreamExecutionResultV1"])
    },
    {
      id: "response-redactor-signature-matches-contract",
      pass:
        RESPONSE_REDACTOR_CONTRACT.id === "response-redactor"
        && sameValues(RESPONSE_REDACTOR_CONTRACT.inputs, ["PolicyEvaluationV1", "UpstreamExecutionResultV1"])
        && sameValues(RESPONSE_REDACTOR_CONTRACT.outputs, ["RedactedResponseV1"])
    },
    {
      id: "trace-recorder-signature-matches-contract",
      pass:
        TRACE_RECORDER_CONTRACT.id === "trace-recorder"
        && sameValues(TRACE_RECORDER_CONTRACT.inputs, [
          "NormalizedProxyContextV1",
          "AuthEvaluationV1",
          "PolicyEvaluationV1",
          "RateLimitDecisionV1",
          "UpstreamExecutionResultV1",
          "RedactedResponseV1"
        ])
        && sameValues(TRACE_RECORDER_CONTRACT.outputs, ["TraceRecordSetV1"])
    },
    {
      id: "cost-meter-signature-matches-contract",
      pass:
        COST_METER_CONTRACT.id === "cost-meter"
        && sameValues(COST_METER_CONTRACT.inputs, [
          "NormalizedProxyContextV1",
          "UpstreamExecutionResultV1",
          "RedactedResponseV1"
        ])
        && sameValues(COST_METER_CONTRACT.outputs, ["CostMeteringRecordV1"])
    },
    {
      id: "exchange-assembler-signature-matches-contract",
      pass:
        EXCHANGE_ASSEMBLER_CONTRACT.id === "exchange-assembler"
        && sameValues(EXCHANGE_ASSEMBLER_CONTRACT.inputs, [
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
        ])
        && sameValues(EXCHANGE_ASSEMBLER_CONTRACT.outputs, ["MiddlewareExecutionReportV1"])
    },
    {
      id: "pipeline-deterministic-for-identical-input",
      pass: JSON.stringify(runOne) === JSON.stringify(runTwo)
    }
  ]
};
