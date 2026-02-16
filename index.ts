import type {
  MiddlewareExecutionReportV1,
  RawProxyInvocationV1
} from "./components/artifacts";
import { evaluateAuth } from "./components/auth-evaluator";
import { costMeter } from "./components/cost-meter";
import { assembleExchange } from "./components/exchange-assembler";
import { evaluatePolicy } from "./components/policy-evaluator";
import { enforceRateLimit } from "./components/rate-limit-enforcer";
import { normalizeRequest } from "./components/request-normalizer";
import { redactRequest } from "./components/request-redactor";
import { redactResponse } from "./components/response-redactor";
import { toolVisibilityFilter } from "./components/tool-visibility-filter";
import { recordTrace } from "./components/trace-recorder";
import { dispatchUpstream } from "./components/upstream-dispatcher";

export function runMcpMiddlewarePlatform(input: RawProxyInvocationV1): MiddlewareExecutionReportV1 {
  const normalizedContext = normalizeRequest(input);
  const authEvaluation = evaluateAuth(normalizedContext);
  const policyEvaluation = evaluatePolicy(normalizedContext, authEvaluation);
  const toolFilterDecision = toolVisibilityFilter(normalizedContext, policyEvaluation);
  const rateLimitDecision = enforceRateLimit(normalizedContext, policyEvaluation);
  const redactedRequest = redactRequest({
    normalizedContext,
    policyEvaluation,
    toolFilterDecision
  });
  const upstreamExecutionResult = dispatchUpstream({
    normalizedContext,
    authEvaluation,
    policyEvaluation,
    rateLimitDecision,
    redactedRequest
  });
  const redactedResponse = redactResponse(policyEvaluation, upstreamExecutionResult);
  const traceRecordSet = recordTrace({
    normalizedContext,
    authEvaluation,
    policyEvaluation,
    rateLimitDecision,
    upstreamExecutionResult,
    redactedResponse
  });
  const costMeteringRecord = costMeter({
    normalizedContext,
    upstreamExecution: upstreamExecutionResult,
    redactedResponse
  });

  return assembleExchange({
    normalizedContext,
    authEvaluation,
    policyEvaluation,
    toolFilterDecision,
    rateLimitDecision,
    redactedRequest,
    upstreamExecutionResult,
    redactedResponse,
    traceRecordSet,
    costMeteringRecord
  });
}
