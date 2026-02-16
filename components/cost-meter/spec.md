# cost-meter

## Purpose

Calculate per-invocation cost and usage outputs from normalized token estimates and pricing.

## Input/Output

Input: `NormalizedProxyContextV1`, `UpstreamExecutionResultV1`, `RedactedResponseV1`
Output: `CostMeteringRecordV1`

## Processing Rules

1. Read `inputTokens` from `requestTokenEstimate`.
2. Read `outputTokens` from `responseTokenEstimate`; if upstream denied, force `0`.
3. Build line items:
- `base-request`: quantity `1`, unit price `pricing.requestBaseFeeUsd`
- `input-tokens`: quantity `inputTokens`, unit price `pricing.inputTokenPriceUsd`
- `output-tokens`: quantity `outputTokens`, unit price `pricing.outputTokenPriceUsd`
4. Compute each `subtotalUsd = quantity * unitPriceUsd`.
5. Compute `totalUsd = sum(subtotals)` rounded to 4 decimal places.
6. Set usage totals and `totalTokens = inputTokens + outputTokens`.
7. Derive `costRecordId = sha256(invocationId + canonical-json(lineItems) + totalUsd)`.

## Ordering

- `lineItems` sorted by `category:asc`, `dimensionKey:asc`

## Edge Cases

- Zero-token invocation: base-request still billed.
- Denied upstream call: output token line item has quantity `0`.
- Primary failure mode: negative token estimate; clamp to `0` before pricing.
