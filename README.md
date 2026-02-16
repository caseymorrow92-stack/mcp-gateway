# mcp-middleware-platform

Deterministic contract scaffold for a pluggable MCP governance middleware pipeline.

## Pipeline

```text
ProxyProcessSpawnRequestV1
  -> proxy-process-governor
  -> ProxyProcessSpawnDecisionV1

RawProxyInvocationV1
  -> request-normalizer
  -> auth-evaluator
  -> policy-evaluator
  -> tool-visibility-filter
  -> rate-limit-enforcer
  -> request-redactor
  -> upstream-dispatcher
  -> response-redactor
  -> trace-recorder
  -> cost-meter
  -> exchange-assembler
  -> MiddlewareExecutionReportV1
```

## Components

| Component | Primary responsibility | Output artifact |
|---|---|---|
| `request-normalizer` | Canonicalize inbound MCP invocation context | `NormalizedProxyContextV1` |
| `auth-evaluator` | Identity/scope gating | `AuthEvaluationV1` |
| `policy-evaluator` | Policy allow/deny/transform evaluation | `PolicyEvaluationV1` |
| `tool-visibility-filter` | Tool visibility and selection eligibility | `ToolFilterDecisionV1` |
| `rate-limit-enforcer` | Fixed-window quota enforcement | `RateLimitDecisionV1` |
| `request-redactor` | Request payload redaction | `RedactedRequestV1` |
| `upstream-dispatcher` | Dispatch decision and upstream result synthesis | `UpstreamExecutionResultV1` |
| `response-redactor` | Response payload redaction | `RedactedResponseV1` |
| `trace-recorder` | OTel-style spans/metrics generation | `TraceRecordSetV1` |
| `cost-meter` | Token and request cost computation | `CostMeteringRecordV1` |
| `exchange-assembler` | Final report assembly | `MiddlewareExecutionReportV1` |
| `proxy-process-governor` | Child process spawn governance for stdio proxy mode | `ProxyProcessSpawnDecisionV1` |

## Output

`MiddlewareExecutionReportV1` contains final status, middleware decisions, enforcement outcomes, observability summary, cost totals, and response metadata for each invocation.

## Quickstart

1. Ensure TypeScript runtime tooling is available (`tsx` is required for the CLI examples).
2. Build the project:

```bash
npm run build
```

3. Run the test vectors and contract suite:

```bash
npm test
```

## Use It

### CLI

The CLI accepts a single `RawProxyInvocationV1` JSON file path:

```bash
npx tsx ./cli.ts ./input.json
```

Stdio proxy mode (runs MCP server as child process):

```bash
npx tsx ./cli.ts --proxy "node path/to/mcp-server.js" --stdio
```

Proxy spawn governance env vars:

- `MCP_PROXY_ALLOWED_PREFIXES` (comma-separated command prefixes, default `node,npx,uvx,python,python3,bun,deno`)
- `MCP_PROXY_MAX_RESTARTS` (default `3`)
- `MCP_PROXY_RESTART_BACKOFF_MS` (default `1000`)
- `MCP_PROXY_KILL_TIMEOUT_MS` (default `3000`)
- `MCP_PROXY_SERVER_PROFILE_ID` (default `default-stdio-profile`)
- `MCP_PROXY_TENANT_ID` (default `proxy-tenant`)

Example `input.json`:

```json
{
  "invocationIdHint": "inv-clean",
  "envelope": {
    "protocolVersion": "2025-01-01",
    "requestId": "req-clean",
    "method": "tools/call",
    "transport": "http",
    "receivedAtEpochMs": 1730000000123,
    "toolCall": {
      "serverId": "crm-server",
      "toolName": "customer.lookup",
      "arguments": {
        "serverId": "crm-server",
        "customerId": "cust-1"
      }
    }
  },
  "context": {
    "tenantId": "tenant-acme",
    "environment": "prod",
    "sessionId": "session-1",
    "userId": "user-1",
    "agentId": "agent-1",
    "orgRoles": ["platform"],
    "scopes": ["tools:read"],
    "sourceIp": "203.0.113.10"
  },
  "policyRules": [],
  "rateLimitRules": [],
  "toolCatalog": [
    {
      "serverId": "crm-server",
      "toolName": "customer.lookup",
      "description": "Look up a customer profile by id",
      "visibility": "public",
      "scopeRequirements": ["tools:read"]
    }
  ],
  "redactionRules": [],
  "pricing": {
    "inputTokenPriceUsd": 0.0001,
    "outputTokenPriceUsd": 0.0002,
    "requestBaseFeeUsd": 0.01
  },
  "usageSnapshot": {
    "tokenEstimateInput": 120,
    "tokenEstimateOutput": 80,
    "historicalCallsInWindow": {},
    "windowStartEpochMs": 1730000000000
  }
}
```

The CLI prints a summary including final status, decision counts, HTTP status, dispatch outcome, and total cost.

Important: include `envelope.toolCall.arguments.serverId`. The current tool filter checks selected tool eligibility using `requestPayload.serverId`.

### Programmatic API

Use `runMcpMiddlewarePlatform` directly:

```ts
import { runMcpMiddlewarePlatform } from "./index";
import type { RawProxyInvocationV1 } from "./components/artifacts";

const input: RawProxyInvocationV1 = /* build invocation */;
const report = runMcpMiddlewarePlatform(input);

console.log(report.finalStatus, report.cost.totalUsd, report.response.httpStatusCode);
```

## Reference Inputs

Reusable scenario vectors live in:

- `tests/e2e.v1.test-vectors.ts`

This is the best reference for valid clean/warning/error/multi-category inputs.

## Build Script

Run `npm run build` to build.

## Deployment Reference

- `docs/mcp-middleware-platform-reference-architecture.md`

## Local Demo

- `demo/mcp-middleware-platform/README.md`
- Quick run: `node demo/mcp-middleware-platform/demo-client.js`
- Run one scenario: `./demo/mcp-middleware-platform/run-scenario.sh allow-all`
- Run all scenarios: `./demo/mcp-middleware-platform/run-scenarios.sh`
