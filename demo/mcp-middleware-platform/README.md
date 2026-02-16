# MCP Middleware Platform - Demo

This demo shows how the MCP Middleware Platform works with different policy configurations.

## Quick Start

```bash
cd ~/code/spec-first-systems/projects/mcp-middleware-platform

# Run a simple end-to-end demo
node demo/mcp-middleware-platform/demo-client.js
```

## Policy Scenarios

Try different policy configurations:

```bash
# Scenario 1: Allow all (permissive)
./demo/mcp-middleware-platform/run-scenario.sh allow-all

# Scenario 2: Deny specific tools
./demo/mcp-middleware-platform/run-scenario.sh deny-specific-tools

# Scenario 3: Rate limiting
./demo/mcp-middleware-platform/run-scenario.sh rate-limit

# Scenario 4: PII redaction
./demo/mcp-middleware-platform/run-scenario.sh redact-pii

# Scenario 5: Tool scope filtering
./demo/mcp-middleware-platform/run-scenario.sh tool-scope-filter

# Run all scenarios
./demo/mcp-middleware-platform/run-scenarios.sh
```

## Policy Types

### 1. Allow All (Permissive)
```json
{
  "policyRules": [{ "policyId": "allow-all", "effect": "allow" }]
}
```
- No restrictions
- All tool calls pass through

### 2. Deny Specific Tools
```json
{
  "policyRules": [
    { "policyId": "deny-file-delete", "effect": "deny", "target": { "toolNames": ["file.delete"] }},
    { "policyId": "allow-other", "effect": "allow" }
  ]
}
```
- Blocks specific tools
- Allows everything else

### 3. Rate Limiting
```json
{
  "rateLimitRules": [
    { "ruleId": "user-rate-limit", "scope": "userId", "maxRequests": 10, "windowMs": 60000 }
  ]
}
```
- Limits requests per user/time window
- Returns 429 when exceeded

### 4. PII Redaction
```json
{
  "redactionRules": [
    { "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", "replacement": "[EMAIL_REDACTED]" }
  ]
}
```
- Masks email, SSN, phone, credit cards
- Applies to requests AND responses

### 5. Tool Scope Filtering
```json
{
  "policyRules": [
    { "effect": "allow", "target": { "toolNames": ["*.read", "*.list"] }},
    { "effect": "deny", "target": { "toolNames": ["*.create", "*.update", "*.delete"] }}
  ]
}
```
- Controls tool visibility by user scope
- Read-only users can't call write tools

## End-to-End Demo

The `demo-client.js` shows a full integration:

1. Starts the middleware proxy
2. Connects to a demo MCP server
3. Sends initialize, tools/list, tools/call requests
4. Shows responses flowing through the proxy

```bash
node demo/mcp-middleware-platform/demo-client.js
```

Output:
```
Starting proxy command:
  npx tsx ./cli.ts --proxy "node demo/mcp-middleware-platform/simple-mcp-server.js" --stdio
initialize -> { "jsonrpc": "2.0", "id": 1, "result": ... }
tools/list -> { "jsonrpc": "2.0", "id": 2, "result": { "tools": [...] } }
tools/call -> { "jsonrpc": "2.0", "id": 3, "result": { "content": [...] } }
```

## Langfuse Integration

To export traces to Langfuse:

```bash
# Set Langfuse credentials
export LANGFUSE_PUBLIC_KEY="pk-..."
export LANGFUSE_SECRET_KEY="sk-..."

# Run with Langfuse enabled
LANGFUSE_ENABLED=true node demo/mcp-middleware-platform/demo-client.js
```

The middleware will export OTel traces to your Langfuse project.

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ MCP Client   │ ──> │ mcp-middleware  │ ──> │ MCP Server   │
│              │     │                 │     │              │
│ - initialize │     │ auth            │     │ - tools/list │
│ - tools/call │     │ policy          │     │ - tools/call │
│              │     │ rate-limit     │     │              │
│              │     │ redact         │     │              │
│              │     │ trace          │     │              │
└──────────────┘     └─────────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Langfuse     │
                    │ (optional)   │
                    └──────────────┘
```

## Files

- `demo-client.js` - End-to-end demo client
- `simple-mcp-server.js` - Simple MCP server for testing
- `scenarios/` - Policy configuration examples
- `run-scenario.sh` - Run individual scenarios
