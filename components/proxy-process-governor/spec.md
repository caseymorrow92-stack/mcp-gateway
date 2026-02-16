# proxy-process-governor

## Purpose

Apply deterministic governance checks to child-process launch requests used by stdio proxy mode.

## Input/Output

Input: `ProxyProcessSpawnRequestV1`
Output: `ProxyProcessSpawnDecisionV1`

## Processing Rules

1. Normalize command by trimming and collapsing repeated whitespace.
2. Split normalized command into argv tokens by whitespace.
3. Normalize `allowedCommandPrefixes` by trimming, lowercasing, de-duplicating, and sorting.
4. Deny if command is empty.
5. Deny if argv[0] is not prefixed by an allowlisted prefix.
6. Clamp restart policy values into deterministic safe bounds:
- `maxRestarts`: `0..10`
- `restartBackoffMs`: `100..60000`
- `killTimeoutMs`: `100..120000`
7. Set `spawn.allowed` from status (`allow`/`deny`).
8. Derive `decisionId` as `sha256(normalizedCommand + prefixes + status + reasonCode + policy)`.

## Ordering

- `allowedCommandPrefixes` are normalized in lexical ascending order before matching.
- `spawn.argv` preserves lexical token order from normalized command.

## Edge Cases

- Empty command => deny with reason `proxy-command-empty`.
- Missing allowlist => deny with reason `proxy-prefix-denied`.
- Allowed prefix with extra spaces still accepted after normalization.
