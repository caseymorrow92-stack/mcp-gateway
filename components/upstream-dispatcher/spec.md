# upstream-dispatcher

## Purpose

Decide whether to dispatch upstream and produce deterministic synthetic upstream execution output.

## Input/Output

Input: `NormalizedProxyContextV1`, `AuthEvaluationV1`, `PolicyEvaluationV1`, `RateLimitDecisionV1`, `RedactedRequestV1`
Output: `UpstreamExecutionResultV1`

## Processing Rules

1. Evaluate blockers in order:
- auth denied => blocked stage `authenticate`
- policy denied => blocked stage `policy`
- rate limit denied => blocked stage `rate-limit`
- request redaction denied => blocked stage `request-redaction`
2. If blocked:
- `status = "deny"`
- `dispatched = false`
- `httpStatusCode = 403` except rate limit uses `429`
- `upstreamLatencyMs = 0`
- `upstreamResponse.error` contains deterministic code/message for blocked stage
3. If not blocked:
- `status = "allow"`
- `dispatched = true`
- `blockedByStage` omitted
- `httpStatusCode = 200`
- `upstreamLatencyMs = min(2000, 5 + requestTokenEstimate / 10)` rounded to integer
- `upstreamResponse.result` contains echoed `serverId`, `toolName`, and `arguments`
4. Derive `decisionId` as `sha256(invocationId + "dispatch" + status + httpStatusCode)`.

## Ordering

- `upstreamResponse.result` keys serialized in stable lexical order for canonical-json compatibility.

## Edge Cases

- Empty request payload: still dispatch when not blocked.
- Minimal blocked auth input: no upstream result payload, only error.
- Primary failure mode: conflicting blocker states; first blocker in order wins.
