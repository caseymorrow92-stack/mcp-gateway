# policy-evaluator

## Purpose

Apply policy rules to compute a deterministic policy decision for the selected MCP tool call.

## Input/Output

Input: `NormalizedProxyContextV1`, `AuthEvaluationV1`
Output: `PolicyEvaluationV1`

## Processing Rules

1. If `AuthEvaluationV1.authenticated` is false, short-circuit with:
- `status = "deny"`
- `applicableRules = []`
- `transformPatches = []`
- `deniedReasonCode = "auth-precondition-failed"`
2. Filter `policyRules` where `stage` is one of `policy`, `request-redaction`, `response-redaction`, or `dispatch`.
3. Evaluate in canonical order from normalized input.
4. A rule is applicable when its `conditionDsl` references current tool name, server id, scope, or wildcard `*` (string contain check, deterministic).
5. Build `applicableRules` entries from matching rules.
6. Final `status` selection priority:
- any matching `deny` rule => `deny`
- else any matching `transform` rule => `transform`
- else any matching `observe-only` => `observe-only`
- else `allow`
7. For each matching `transform` rule, generate one patch `{ path: "$.arguments", op: "set", value: { policyRuleId: ruleId } }`.
8. Sort `transformPatches` by `path asc`, `op asc`.
9. Set `deniedReasonCode` to first deny rule reason by rule order when status is deny.
10. Derive `decisionId` as `sha256(invocationId + "policy" + status + (deniedReasonCode || "none"))`.

## Ordering

- `applicableRules`: `priority:desc`, `ruleId:asc`
- `transformPatches`: `path:asc`, `op:asc`

## Edge Cases

- Empty policy set: output `status = "allow"` with empty rules/patches.
- Auth denied input: always deny regardless of policy rules.
- Primary failure mode: ambiguous mixed rules (deny and transform); deny wins deterministically.
