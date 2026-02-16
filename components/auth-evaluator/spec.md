# auth-evaluator

## Purpose

Evaluate whether the principal in `NormalizedProxyContextV1` is authenticated and authorized at the identity/scope layer.

## Input/Output

Input: `NormalizedProxyContextV1`
Output: `AuthEvaluationV1`

## Processing Rules

1. Build `failedChecks` list:
- add `missing-tenant` when `tenantId` is empty.
- add `missing-user` when `userId` is empty.
- add `missing-agent` when `agentId` is empty.
- add `missing-scopes` when `scopes` is empty.
2. Determine `authenticated = failedChecks.length === 0`.
3. Compute `status`: `allow` if authenticated, otherwise `deny`.
4. Set `reasonCode`:
- `auth-ok` when authenticated.
- `auth-missing-principal` when tenant/user/agent missing.
- `auth-missing-scopes` when only scopes missing.
5. Set `principal` from normalized identity fields and `effectiveScopes = scopes`.
6. Derive `decisionId` as `sha256(invocationId + "authenticate" + status + reasonCode)`.

## Ordering

- `principal.effectiveScopes` remains sorted ascending from input normalization.
- `failedChecks` sorted ascending lexicographically before output.

## Edge Cases

- Empty `scopes` with otherwise valid identity: deny with `reasonCode = "auth-missing-scopes"`.
- Minimal valid principal: allow with empty `failedChecks`.
- Primary failure mode: whitespace-only identity fields; treat as empty and deny.
