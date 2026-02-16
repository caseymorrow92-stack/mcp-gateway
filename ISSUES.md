# Known Integration Risks

## tool-visibility-filter selected server resolution can force false denies

- Component: `components/tool-visibility-filter/index.ts`
- Behavior: the selected server id is read from `normalizedContext.requestPayload.serverId`.
- Risk: `request-normalizer` maps `envelope.toolCall.arguments` into `requestPayload` and does not copy `envelope.toolCall.serverId`, so `selectedToolAllowed` can become `false` unless callers duplicate `serverId` inside tool arguments.
- Effect: valid requests may be denied at `tool-filter`, then cascaded into request-redaction/upstream deny.
- Status: documented only; component implementation unchanged per integration constraints.
