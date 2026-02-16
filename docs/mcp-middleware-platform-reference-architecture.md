# MCP Middleware Platform Reference Architecture

This project implements a deterministic middleware chain for MCP proxy invocations.

## Execution Flow

1. Normalize inbound invocation context.
2. Evaluate identity, scopes, and policy.
3. Enforce tool visibility and rate limits.
4. Redact request payloads where needed.
5. Dispatch upstream request and capture response metadata.
6. Redact response payloads.
7. Emit trace and cost records.
8. Assemble final `MiddlewareExecutionReportV1` output.

## Core Entrypoints

- Runtime pipeline: `../index.ts`
- CLI: `../cli.ts`
- Contracts: `../program.contract.ts`, `../components/auth-evaluator/contract.ts`
- End-to-end vectors: `../tests/e2e.v1.test-vectors.ts`

## Local Run

```bash
npm run build
npm test
node demo/mcp-middleware-platform/demo-client.js
```

## Demo Assets

- Scenario files: `../demo/mcp-middleware-platform/scenarios`
- Runners: `../demo/mcp-middleware-platform/runners`
