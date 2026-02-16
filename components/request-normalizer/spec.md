# request-normalizer

## Purpose

Transform `RawProxyInvocationV1` into a canonical `NormalizedProxyContextV1` used by all downstream middleware stages.

## Input/Output

Input: `RawProxyInvocationV1`
Output: `NormalizedProxyContextV1`

## Processing Rules

1. Derive `invocationId` as `sha256(canonical-json(envelope + context))` unless `invocationIdHint` is present and non-empty; when hint exists, hash `invocationIdHint + canonical-json(envelope.requestId)`.
2. Derive `traceId` as `sha256(invocationId + envelope.method + envelope.toolCall.toolName)`.
3. Set `normalizedMethod` to lowercase of `envelope.method`.
4. Set `normalizedToolName` to lowercase of `envelope.toolCall.toolName`.
5. Copy identity fields: `tenantId`, `userId`, `agentId` from `context`.
6. Normalize `scopes`: trim strings, lowercase, drop empties, deduplicate, then sort ascending.
7. Copy `requestPayload` from `envelope.toolCall.arguments`; if not an object, emit `{}`.
8. Set `requestTokenEstimate` and `responseTokenEstimate` from `usageSnapshot.tokenEstimateInput` and `usageSnapshot.tokenEstimateOutput`.
9. Sort `policyRules` by `priority desc`, then `ruleId asc`.
10. Sort `rateLimitRules` by `dimension asc`, `windowSeconds asc`, `limit asc`, `ruleId asc`.
11. Sort `toolCatalog` by `serverId asc`, `toolName asc`.
12. Sort `redactionRules` by `ruleId asc`, `matchPath asc`.
13. Copy `pricing`, `historicalCallsInWindow`, and `windowStartEpochMs` unchanged.

## Ordering

- `policyRules`: `priority:desc`, `ruleId:asc`
- `rateLimitRules`: `dimension:asc`, `windowSeconds:asc`, `limit:asc`, `ruleId:asc`
- `toolCatalog`: `serverId:asc`, `toolName:asc`
- `redactionRules`: `ruleId:asc`, `matchPath:asc`

## Edge Cases

- Empty input arrays: output corresponding arrays as empty; never `null`.
- Minimal input with missing optional hint: still derive deterministic `invocationId` from envelope/context.
- Primary failure mode: malformed `envelope.toolCall.arguments`; recover by setting `requestPayload` to `{}`.
