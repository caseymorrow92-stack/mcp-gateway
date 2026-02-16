# tool-visibility-filter

## Purpose

Determine visible tools and whether the selected tool can execute under scope and policy constraints.

## Input/Output

Input: `NormalizedProxyContextV1`, `PolicyEvaluationV1`
Output: `ToolFilterDecisionV1`

## Processing Rules

1. If `PolicyEvaluationV1.status` is `deny`, return:
- `status = "deny"`
- `allowedTools = []`
- every catalog tool in `blockedTools` with `reasonCode = "policy-deny"`
- `selectedToolAllowed = false`
2. For each `toolCatalog` entry, evaluate visibility:
- block with `reasonCode = "tool-private"` when `visibility` is `private`.
- block with `reasonCode = "missing-scope"` when required scope absent in `scopes`.
- otherwise allow.
3. `allowedTools` rows include deterministic summary string:
- `summarizedDescription = description.slice(0, 120)`.
4. Determine `selectedToolAllowed` by exact match on `serverId` and lowercased `toolName` against `normalizedToolName`.
5. Set `status = "allow"` when selected tool allowed, else `deny`.
6. Derive `decisionId` as `sha256(invocationId + "tool-filter" + status + normalizedToolName)`.

## Ordering

- `allowedTools` sorted by `serverId:asc`, `toolName:asc`
- `blockedTools` sorted by `reasonCode:asc`, `serverId:asc`, `toolName:asc`

## Edge Cases

- Empty catalog: selected tool cannot be validated, return deny.
- Minimal catalog with one allowed tool: allow and one `allowedTools` entry.
- Primary failure mode: catalog tool names with inconsistent casing; compare case-insensitively.
