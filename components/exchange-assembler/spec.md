# exchange-assembler

## Purpose

Assemble all middleware stage outputs into `MiddlewareExecutionReportV1` for downstream delivery, auditing, and billing.

## Input/Output

Input: `NormalizedProxyContextV1`, `AuthEvaluationV1`, `PolicyEvaluationV1`, `ToolFilterDecisionV1`, `RateLimitDecisionV1`, `RedactedRequestV1`, `UpstreamExecutionResultV1`, `RedactedResponseV1`, `TraceRecordSetV1`, `CostMeteringRecordV1`
Output: `MiddlewareExecutionReportV1`

## Processing Rules

1. Build `middlewareDecisions` with one row per stage/component using each artifact `decisionId`, status, and reason code.
2. Set `finalStatus`:
- `blocked` when any gating stage denied (`authenticate`, `policy`, `tool-filter`, `rate-limit`, `request-redaction`, `dispatch`)
- `errored` when upstream status is deny with HTTP status >= 500
- otherwise `served`
3. Fill `requestSummary` from normalized identity and tool fields.
4. Fill `enforcementSummary` from auth/policy/rate/tool outputs.
5. Fill `observability` from trace spans/metrics counts.
6. Fill `cost` from cost record totals.
7. Fill `response` from upstream and response-redactor outputs.
8. Derive `executionReportId = sha256(invocationId + policyDecisionId + rateLimitDecisionId + costRecordId)`.
9. Copy `invocationId` and `traceId` from normalized context.

## Ordering

- `middlewareDecisions` sorted by `stage:asc`, `status:asc`

## Edge Cases

- Empty decision arrays are invalid; assembler must still emit all expected stage rows.
- Minimal blocked auth flow: final status blocked with upstream not dispatched.
- Primary failure mode: inconsistent decision IDs across artifacts; assemble using artifact-local IDs and do not regenerate.
