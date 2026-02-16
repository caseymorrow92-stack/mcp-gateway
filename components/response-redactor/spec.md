# response-redactor

## Purpose

Apply response-side redaction to upstream result/error payloads before final delivery.

## Input/Output

Input: `PolicyEvaluationV1`, `UpstreamExecutionResultV1`
Output: `RedactedResponseV1`

## Processing Rules

1. Initialize `responsePayload` from `UpstreamExecutionResultV1.upstreamResponse.result` when present; otherwise from error object.
2. If upstream status is deny and no payload exists, set `responsePayload = {}`.
3. If policy status is `transform`, apply deterministic transform:
- remove key `internalNotes` when present
- mask key `secret` with `"[redacted]"`
4. Emit `RedactionEvent` for each modified key.
5. Set `status`:
- `transform` when events > 0
- otherwise inherit `UpstreamExecutionResultV1.status`
6. Set `containsSensitiveData` true when keys `ssn`, `creditCard`, or `apiKey` remain after redaction.
7. Derive `decisionId` as `sha256(upstreamDecisionId + "response-redaction" + status + redactionEvents.length)`.

## Ordering

- `redactionEvents` sorted by `locationPath:asc`, `ruleId:asc`

## Edge Cases

- Empty upstream payload: output empty payload and no redactions.
- Minimal transformed payload: one changed field yields one event.
- Primary failure mode: non-object payload; coerce to `{ raw: payload }` before applying rules.
