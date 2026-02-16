# request-redactor

## Purpose

Apply request-side redaction and produce the outbound safe tool arguments payload.

## Input/Output

Input: `NormalizedProxyContextV1`, `PolicyEvaluationV1`, `ToolFilterDecisionV1`
Output: `RedactedRequestV1`

## Processing Rules

1. If policy status is `deny` or `selectedToolAllowed` is false:
- return `status = "deny"`
- return original arguments as `arguments`
- return empty `redactionEvents`
2. Start from deep copy of `requestPayload` as mutable object.
3. Iterate `redactionRules` in normalized order.
4. For each rule, resolve `matchPath` against payload keys (dot-path traversal).
5. If match exists, apply mode:
- `mask`: replace with `replacement`
- `drop`: remove field
- `hash`: replace with deterministic hash of original string value
6. Emit `RedactionEvent` with `ruleId`, `locationPath`, `mode`, previews.
7. Set `status = "transform"` when at least one event exists; else `allow`.
8. Set `serverId` and `toolName` from normalized context values.
9. Derive `decisionId` as `sha256(invocationId + "request-redaction" + status + redactionEvents.length)`.

## Ordering

- `redactionEvents` sorted by `locationPath:asc`, `ruleId:asc`

## Edge Cases

- Empty redaction rule set: pass through unchanged arguments with `status = "allow"`.
- Minimal input with one matching field: exactly one redaction event.
- Primary failure mode: non-object payload values at match path; skip event for that rule/path.
