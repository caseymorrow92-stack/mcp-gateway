# MCP Gateway

Pluggable governance layer for MCP-powered AI agents. Add security, observability, and control to your AI agents without changing a single line of code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/mcp-gateway)](package.json)

## Why MCP Gateway?

AI agents powered by MCP (Model Context Protocol) are transforming how we build software. But there's a problem: **you can't deploy AI agents to production without governance.**

- No audit trail for tool calls
- No way to enforce access policies
- No rate limiting or cost controls
- No PII redaction on sensitive data

MCP Gateway sits between your AI agent and MCP servers, adding a pluggable middleware layer for security, observability, and control.

## Key Features

- **Policy Enforcement** — Allow/deny/transform tool calls based on declarative policies
- **Rate Limiting** — Throttle requests per user, agent, or tool
- **PII Redaction** — Automatically mask sensitive data in requests and responses  
- **Tool Filtering** — Control which tools are visible to which users
- **Observability** — Built-in OTel-compatible tracing and cost metering
- **Process Governance** — Secure child process spawning for stdio proxy mode

## Quick Start

### Installation

```bash
npm install -g mcp-gateway
```

Or use directly with npx:

```bash
npx mcp-gateway --help
```

### Run with an MCP Server

```bash
npx mcp-gateway --stdio -- "npx @modelcontextprotocol/server-filesystem /data"
```

Your MCP client connects to the gateway instead of the server directly.

### With Policy Configuration

```bash
npx mcp-gateway --policy-file ./my-policy.json --stdio -- "node my-mcp-server.js"
```

## Policy Configuration

Create a `policy.json` file:

```json
{
  "policyRules": [
    {
      "policyId": "deny-sensitive",
      "effect": "deny",
      "target": {
        "toolNames": ["file.delete", "db.drop"]
      }
    },
    {
      "policyId": "allow-other",
      "effect": "allow"
    }
  ],
  "rateLimitRules": [
    {
      "ruleId": "user-limit",
      "scope": "userId",
      "maxRequests": 100,
      "windowMs": 60000
    }
  ],
  "redactionRules": [
    {
      "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      "replacement": "[EMAIL]"
    }
  ]
}
```

## Demo

Run the built-in demo:

```bash
node demo/mcp-middleware-platform/demo-client.js
```

Try different policy scenarios:

```bash
./demo/mcp-middleware-platform/run-scenario.sh allow-all
./demo/mcp-middleware-platform/run-scenario.sh deny-specific-tools
./demo/mcp-middleware-platform/run-scenario.sh redact-pii
```

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ MCP Client   │ ──> │ mcp-gateway    │ ──> │ MCP Server   │
│ (Claude,     │     │                 │     │              │
│  OpenAI,      │     │ auth            │     │ - fileserver │
│  LangChain)   │     │ policy          │     │ - database   │
│              │     │ rate-limit      │     │ - search     │
│              │     │ redact         │     │              │
│              │     │ trace          │     │              │
└──────────────┘     └─────────────────┘     └──────────────┘
```

## Use Cases

- **Enterprise Security** — SOC2 compliance, audit trails, data loss prevention
- **Rate Limiting** — Prevent runaway agents from hitting API limits
- **Cost Control** — Track and limit token usage per user/team
- **Data Privacy** — Redact PII before it reaches AI agents
- **Access Control** — Different tools for different user roles

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| Open Source | Free | Core middleware, CLI |
| Pro | $49/mo | OTel export, Langfuse, dashboard |
| Enterprise | Custom | SSO, SLA, on-prem support |

## Contributing

Contributions welcome! Check our [Contributing Guide](CONTRIBUTING.md) for setup instructions.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Links

- [Documentation](docs/)
- [GitHub](https://github.com/caseymorrow92-stack/mcp-gateway)
- [npm](https://www.npmjs.com/package/mcp-gateway)
