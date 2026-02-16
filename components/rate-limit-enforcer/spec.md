# rate-limit-enforcer

## Purpose

Apply deterministic fixed-window rate limits for user, agent, and tool dimensions.

## Input/Output

Input: `NormalizedProxyContextV1`, `PolicyEvaluationV1`
Output: `RateLimitDecisionV1`

## Processing Rules

1. If `PolicyEvaluationV1.status` is `deny`, emit a denied decision with no applied rules and `deniedReasonCode = "policy-deny"`.
2. For each `rateLimitRules` entry, build lookup key:
- `user` => `tenantId:userId`
- `agent` => `tenantId:agentId`
- `tool` => `tenantId:normalizedToolName`
3. Read `observedCount` from `historicalCallsInWindow[key]` defaulting to `0`.
4. Build `appliedRules` row with rule properties plus observed count.
5. Rule passes when `observedCount < limit`; fails otherwise.
6. If any rule fails:
- set `allowed = false`
- set `status = "deny"`
- set `deniedReasonCode = "rate-limit-exceeded"`
- compute `retryAfterSeconds = max(0, windowSeconds - floor((receivedAtEpochMs - windowStartEpochMs)/1000))`
7. If all pass:
- set `allowed = true`
- set `status = "allow"`
- set `retryAfterSeconds = 0`
8. Derive `decisionId` as `sha256(invocationId + "rate-limit" + status + (deniedReasonCode || "none"))`.

## Ordering

- `appliedRules` sorted by `dimension:asc`, `windowSeconds:asc`, `limit:asc`

## Edge Cases

- Empty rate limit rules: allow with empty `appliedRules`.
- Minimal single-rule input: deterministic pass/fail from observed count.
- Primary failure mode: missing historical key; treat as zero usage.
