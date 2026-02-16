# MCP Middleware Platform Reference Architecture

This document describes where `mcp-middleware-platform` fits in an enterprise stack, what services are required, and how to run it locally.

## 1) Where It Fits

`mcp-middleware-platform` sits between MCP clients and MCP servers.

- Northbound: MCP clients/agent runtimes
- Data plane: MCP middleware proxy runtime
- Southbound: one or more MCP servers (typically stdio child processes in local mode)
- Side systems: policy service, identity service, telemetry backend, config store

## 2) Logical Components

- Proxy Runtime
- Terminates MCP transport (stdio now), frames messages, runs middleware, forwards/block/transforms traffic.

- Middleware Engine
- Deterministic evaluation pipeline from raw invocation to `MiddlewareExecutionReportV1`.

- Process Governor
- Deterministic child-process launch policy (`proxy-process-governor`) for allowlisted commands and bounded restart/kill policy.

- Control Plane (required for enterprise)
- Stores policy/rate-limit/redaction/tool visibility config and rollout versions.

- Observability + Audit
- Exports traces/metrics/log decisions and stores immutable audit events.

## 3) Deployment Topologies

### A. Sidecar per Agent Runtime

- One proxy instance per agent workload.
- Pros: strong isolation, tenant scoping is simple.
- Cons: higher fleet count.

### B. Shared Proxy Gateway

- Multi-tenant proxy service cluster.
- Pros: centralized operations and policy distribution.
- Cons: stricter multi-tenant isolation and quota controls required.

### C. Hybrid

- Shared gateway for low-risk workloads + sidecar for high-trust or regulated workloads.

## 4) Enterprise Minimum Requirements

- Identity mapping (OIDC/JWT/mTLS) into `tenantId`, `userId`, `agentId`.
- Externalized policy/config bundles with versioned rollout and rollback.
- Persistent audit logs for all allow/deny/transform decisions.
- SLOs and alerting (proxy availability, upstream failure rate, policy-deny anomalies).
- Runtime isolation for child processes (container/user/seccomp/resource quotas).
- Secrets management and key rotation.

## 5) Runtime Controls in This Repo

Current proxy runtime controls (stdio mode):

- Command allowlist prefixes via `MCP_PROXY_ALLOWED_PREFIXES`
- Bounded restart count via `MCP_PROXY_MAX_RESTARTS`
- Restart backoff via `MCP_PROXY_RESTART_BACKOFF_MS`
- Forced kill timeout via `MCP_PROXY_KILL_TIMEOUT_MS`

Implemented in `cli.ts` and `components/proxy-process-governor`.

## 6) Local Quickstart (Demo)

From repo root:

```bash
node demo/mcp-middleware-platform/demo-client.js
```

Prerequisite: `tsx` is required for proxy CLI execution (`npx tsx ...`).

This runs:

1. demo MCP server (`demo/mcp-middleware-platform/simple-mcp-server.js`)
2. middleware proxy in stdio mode (`./cli.ts --proxy ... --stdio`)
3. demo MCP client sequence (`initialize` -> `tools/list` -> `tools/call`)

Expected output includes successful JSON-RPC responses and uppercase echo output from the demo tool.

## 7) Manual Run (Alternative)

Terminal A:

```bash
npx tsx ./cli.ts --proxy "node demo/mcp-middleware-platform/simple-mcp-server.js" --stdio
```

Terminal B (send framed MCP requests through proxy):

```bash
node demo/mcp-middleware-platform/demo-client.js --proxy-command "npx tsx ./cli.ts --proxy 'node demo/mcp-middleware-platform/simple-mcp-server.js' --stdio"
```

## 8) Next Hardening Steps

1. Add process pool manager (warm workers, per-profile limits).
2. Add enforcement mode switch (observe-only vs enforce).
3. Add policy bundle loader from control plane.
4. Add tenant-scoped quotas and circuit breakers.
5. Add signed audit export pipeline.
