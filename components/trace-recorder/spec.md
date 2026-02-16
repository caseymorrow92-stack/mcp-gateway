# trace-recorder

## Purpose

Generate deterministic span and metric artifacts representing middleware execution for observability export.

## Input/Output

Input: `NormalizedProxyContextV1`, `AuthEvaluationV1`, `PolicyEvaluationV1`, `RateLimitDecisionV1`, `UpstreamExecutionResultV1`, `RedactedResponseV1`
Output: `TraceRecordSetV1`

## Processing Rules

1. Use input `traceId` as `TraceRecordSetV1.traceId`.
2. Create exactly six spans for stages:
- authenticate
- policy
- rate-limit
- dispatch
- response-redaction
- cost-meter (placeholder execution marker)
3. For each span:
- derive `spanId = sha256(traceId + spanKind + spanName + ordinal)`
- `spanKind = "middleware"` except dispatch is `"upstream"`
- set `status = "ok"` for allow/transform and `"error"` for deny
- include attributes: `tenantId`, `userId`, `agentId`, `toolName`, `decisionStatus`
4. Create metrics:
- `middleware.blocked` => 1 when upstream denied else 0
- `middleware.http_status` => upstream HTTP status code
- `middleware.upstream_latency_ms` => upstream latency
- `middleware.redaction_events` => response redaction event count
5. Set `exportTarget = "otel-collector"`.

## Ordering

- `spans` sorted by `spanKind:asc`, `spanName:asc`
- `metrics` sorted by `key:asc`

## Edge Cases

- Fully blocked invocation still produces six spans with error status on failed stage.
- Minimal allow flow emits six spans and four metrics.
- Primary failure mode: missing traceId; derive fallback hash from invocationId.
