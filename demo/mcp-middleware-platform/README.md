# Demo: mcp-middleware-platform

This demo is now fully local to this project, including runners and scenario inputs.

## Structure

- `runners/run-scenario.js`
- `runners/run-all-scenarios.js`
- `scenarios/clean.json`
- `scenarios/missing-serverid-arg.json`

## Commands

Run the default clean scenario:

```bash
node demo/mcp-middleware-platform/demo-client.js
```

Run a specific scenario:

```bash
node demo/mcp-middleware-platform/runners/run-scenario.js missing-serverid-arg.json
```

Run all scenarios:

```bash
node demo/mcp-middleware-platform/runners/run-all-scenarios.js
```

All runner commands execute the project CLI from repo root using the selected scenario file.
