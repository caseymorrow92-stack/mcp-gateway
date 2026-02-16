#!/usr/bin/env npx tsx

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Readable, Writable } from "node:stream";

import type { ProxyProcessSpawnRequestV1, RawProxyInvocationV1 } from "./components/artifacts";
import { evaluateProxyProcessSpawn } from "./components/proxy-process-governor";
import { runMcpMiddlewarePlatform } from "./index";

// Global policy config for stdio proxy mode
let globalPolicyConfig: PolicyConfig | undefined;

function usage(): void {
  console.error(`Usage:
  npx tsx ./cli.ts <input.json>
  npx tsx ./cli.ts --stdio --policy-file <policy.json> -- "node path/to/mcp-server.js"
  npx tsx ./cli.ts --proxy "node path/to/mcp-server.js" --stdio
  npx tsx ./cli.ts --policy-file <policy.json> --stdio -- "node path/to/mcp-server.js"

Options:
  --policy-file, -p <file>   Policy configuration JSON file
  --stdio                     Run in stdio proxy mode
  --proxy <cmd>              MCP server command to spawn
  --help, -h                Show this help
`);
}

function countCategories(report: ReturnType<typeof runMcpMiddlewarePlatform>): {
  errorCount: number;
  warningCount: number;
  categories: string[];
} {
  const errorCount = report.middlewareDecisions.filter((decision) => decision.status === "deny").length;
  const warningCount = report.middlewareDecisions.filter(
    (decision) => decision.status === "observe-only" || decision.status === "transform"
  ).length;
  const categories = Array.from(
    new Set(
      report.middlewareDecisions
        .filter((decision) => decision.status !== "allow")
        .map((decision) => decision.stage)
    )
  ).sort();

  return { errorCount, warningCount, categories };
}

type CliArgs = {
  inputPath?: string;
  proxyCommand?: string;
  stdioMode: boolean;
  policyFile?: string;
};

type JsonRecord = Record<string, unknown>;
const DEBUG_PROXY = process.env.MCP_PROXY_DEBUG === "1";

function debugLog(message: string): void {
  if (DEBUG_PROXY) {
    console.error(`[mcp-proxy-debug] ${message}`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    stdioMode: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }

    if (token === "--stdio") {
      parsed.stdioMode = true;
      continue;
    }

    if (token === "--policy-file" || token === "-p") {
      const next = argv[i + 1];
      if (typeof next === "string" && next.length > 0 && next !== "--") {
        parsed.policyFile = next;
        i += 1;
      }
      continue;
    }

    if (token === "--proxy") {
      const next = argv[i + 1];
      if (typeof next === "string" && next.length > 0 && next !== "--") {
        parsed.proxyCommand = next;
        i += 1;
      }
      continue;
    }

    if (token === "--") {
      const commandParts = argv.slice(i + 1);
      if (commandParts.length > 0) {
        parsed.proxyCommand = commandParts.join(" ");
      }
      break;
    }

    if (!parsed.inputPath) {
      parsed.inputPath = token;
    }
  }

  return parsed;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

function getMethod(message: JsonRecord): string {
  const method = message.method;
  if (typeof method === "string" && method.length > 0) {
    return method;
  }
  if ("result" in message || "error" in message) {
    return "rpc.response";
  }
  return "rpc.unknown";
}

function toArguments(message: JsonRecord): Record<string, unknown> {
  const params = message.params;
  if (isRecord(params)) {
    return params;
  }

  if ("result" in message && isRecord(message.result)) {
    return message.result;
  }

  if ("error" in message && isRecord(message.error)) {
    return message.error;
  }

  return {};
}

function toToolName(message: JsonRecord): string {
  const method = getMethod(message);
  if (method === "tools/call" && isRecord(message.params) && typeof message.params.name === "string") {
    return message.params.name;
  }
  return method;
}

type PolicyConfig = {
  policyRules?: unknown[];
  rateLimitRules?: unknown[];
  redactionRules?: unknown[];
};

function createProxyInvocation(
  message: JsonRecord, 
  direction: "inbound" | "outbound",
  policyConfig?: PolicyConfig
): RawProxyInvocationV1 {
  const requestId = asStringId(message.id);
  const method = getMethod(message);
  const argumentsPayload = toArguments(message);
  const serialized = JSON.stringify(message);
  const tokenEstimate = Math.max(0, Math.ceil(serialized.length / 4));
  const now = Date.now();

  return {
    invocationIdHint: `${direction}-${requestId || "notification"}-${now}`,
    envelope: {
      protocolVersion: "2.0",
      requestId: requestId || `${direction}-${now}`,
      method,
      transport: "stdio",
      receivedAtEpochMs: now,
      toolCall: {
        serverId: "upstream-mcp-server",
        toolName: toToolName(message),
        arguments: argumentsPayload
      }
    },
    context: {
      tenantId: "proxy-tenant",
      environment: "prod",
      sessionId: "stdio-proxy-session",
      userId: "proxy-user",
      agentId: "mcp-middleware-platform-cli",
      orgRoles: ["proxy"],
      scopes: ["proxy:stdio"],
      sourceIp: "127.0.0.1"
    },
    policyRules: policyConfig?.policyRules || [],
    rateLimitRules: policyConfig?.rateLimitRules || [],
    toolCatalog: [],
    redactionRules: policyConfig?.redactionRules || [],
    pricing: {
      inputTokenPriceUsd: 0,
      outputTokenPriceUsd: 0,
      requestBaseFeeUsd: 0
    },
    usageSnapshot: {
      tokenEstimateInput: tokenEstimate,
      tokenEstimateOutput: tokenEstimate,
      historicalCallsInWindow: {},
      windowStartEpochMs: now
    }
  };
}

function processMessageForMiddleware(messageBuffer: Buffer, direction: "inbound" | "outbound"): void {
  try {
    const message = JSON.parse(messageBuffer.toString("utf8")) as JsonRecord;
    if (isRecord(message)) {
      debugLog(`middleware ${direction} method=${getMethod(message)} id=${asStringId(message.id) || "notification"}`);
      runMcpMiddlewarePlatform(createProxyInvocation(message, direction, globalPolicyConfig));
    }
  } catch {
    // Best-effort parsing only. Forwarding continues unchanged.
  }
}

function createFramedMessageInterceptor(options: {
  source: Readable;
  destination: Writable;
  direction: "inbound" | "outbound";
  closeDestinationOnEnd?: boolean;
}): { dispose: () => void } {
  let pending = Buffer.alloc(0);

  const onData = (chunk: Buffer | string): void => {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    debugLog(`${options.direction} chunk bytes=${String(chunkBuffer.length)}`);
    pending = Buffer.concat([pending, chunkBuffer]);

    while (true) {
      const headerBoundary = pending.indexOf("\r\n\r\n");
      if (headerBoundary < 0) {
        return;
      }

      const headerText = pending.slice(0, headerBoundary).toString("utf8");
      const lengthMatch = headerText.match(/content-length:\s*(\d+)/i);
      if (!lengthMatch) {
        debugLog(`${options.direction} non-framed payload bytes=${String(pending.length)}`);
        options.destination.write(pending);
        pending = Buffer.alloc(0);
        return;
      }

      const contentLength = Number.parseInt(lengthMatch[1], 10);
      if (!Number.isFinite(contentLength) || contentLength < 0) {
        options.destination.write(pending);
        pending = Buffer.alloc(0);
        return;
      }

      const messageStart = headerBoundary + 4;
      const messageEnd = messageStart + contentLength;
      if (pending.length < messageEnd) {
        return;
      }

      const body = pending.slice(messageStart, messageEnd);
      const frame = pending.slice(0, messageEnd);
      processMessageForMiddleware(body, options.direction);
      debugLog(`${options.direction} forwarded frame bytes=${String(frame.length)}`);
      options.destination.write(frame);
      pending = pending.slice(messageEnd);
    }
  };

  const onEnd = (): void => {
    if (pending.length > 0) {
      options.destination.write(pending);
      pending = Buffer.alloc(0);
    }
    if (options.closeDestinationOnEnd !== false) {
      options.destination.end();
    }
  };

  options.source.on("data", onData);
  options.source.on("end", onEnd);

  return {
    dispose: () => {
      options.source.off("data", onData);
      options.source.off("end", onEnd);
      pending = Buffer.alloc(0);
    }
  };
}

function runStdioProxy(proxyCommand: string, policyConfig?: Record<string, unknown>): number {
  const spawnRequest = buildProxyProcessSpawnRequest(proxyCommand);
  const spawnDecision = evaluateProxyProcessSpawn(spawnRequest);
  debugLog(`proxy decision status=${spawnDecision.status} reason=${spawnDecision.reasonCode} command="${spawnDecision.normalizedCommand}"`);

  if (!spawnDecision.spawn.allowed) {
    console.error(`Failed: proxy spawn denied (${spawnDecision.reasonCode})`);
    return 1;
  }

  // Extract policy rules from config
  const policyRules = Array.isArray(policyConfig?.policyRules) ? policyConfig.policyRules : [];
  const rateLimitRules = Array.isArray(policyConfig?.rateLimitRules) ? policyConfig.rateLimitRules : [];
  const redactionRules = Array.isArray(policyConfig?.redactionRules) ? policyConfig.redactionRules : [];
  
  // Set global policy config for use in message processing
  globalPolicyConfig = { policyRules, rateLimitRules, redactionRules };

  let activeChild: ReturnType<typeof spawn> | null = null;
  let activeInboundBridge: { dispose: () => void } | null = null;
  let activeOutboundBridge: { dispose: () => void } | null = null;
  let shutdownRequested = false;
  let restartsRemaining = spawnDecision.spawn.maxRestarts;

  const disposeActiveBridges = (): void => {
    if (activeInboundBridge) {
      activeInboundBridge.dispose();
      activeInboundBridge = null;
    }
    if (activeOutboundBridge) {
      activeOutboundBridge.dispose();
      activeOutboundBridge = null;
    }
  };

  const forceTerminateAfterTimeout = (childProcess: ReturnType<typeof spawn>): void => {
    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill("SIGKILL");
      }
    }, spawnDecision.spawn.killTimeoutMs).unref();
  };

  const launchChild = (): void => {
    debugLog(`launching child: ${spawnDecision.spawn.argv.join(" ")}`);
    const child = spawn(spawnDecision.spawn.argv[0], spawnDecision.spawn.argv.slice(1), {
      stdio: ["pipe", "pipe", "inherit"]
    });

    if (!child.stdin || !child.stdout) {
      console.error("Failed: could not initialize stdio streams for child MCP server");
      process.exit(1);
    }

    activeChild = child;
    activeInboundBridge = createFramedMessageInterceptor({
      source: process.stdin,
      destination: child.stdin,
      direction: "inbound",
      closeDestinationOnEnd: true
    });
    activeOutboundBridge = createFramedMessageInterceptor({
      source: child.stdout,
      destination: process.stdout,
      direction: "outbound",
      closeDestinationOnEnd: false
    });

    child.once("error", (error) => {
      disposeActiveBridges();
      activeChild = null;
      const message = error instanceof Error ? error.message : String(error);
      if (shutdownRequested) {
        process.exit(1);
        return;
      }
      if (restartsRemaining > 0) {
        debugLog(`child error restart remaining=${String(restartsRemaining)}`);
        restartsRemaining -= 1;
        setTimeout(() => {
          launchChild();
        }, spawnDecision.spawn.restartBackoffMs).unref();
        return;
      }
      console.error(`Failed: ${message}`);
      process.exit(1);
    });

    child.once("exit", (code, signal) => {
      debugLog(`child exit code=${String(code)} signal=${String(signal)}`);
      disposeActiveBridges();
      activeChild = null;

      if (shutdownRequested) {
        if (signal) {
          process.exit(1);
          return;
        }
        process.exit(code ?? 0);
        return;
      }

      const restartableFailure = signal !== null || (typeof code === "number" && code !== 0);
      if (restartableFailure && restartsRemaining > 0) {
        restartsRemaining -= 1;
        setTimeout(() => {
          launchChild();
        }, spawnDecision.spawn.restartBackoffMs).unref();
        return;
      }

      if (signal) {
        process.exit(1);
        return;
      }
      process.exit(code ?? 0);
    });
  };

  const shutdown = (): void => {
    shutdownRequested = true;
    const child = activeChild;
    if (child && !child.killed) {
      child.kill("SIGTERM");
      forceTerminateAfterTimeout(child);
      return;
    }
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  launchChild();

  return 0;
}

function buildProxyProcessSpawnRequest(proxyCommand: string): ProxyProcessSpawnRequestV1 {
  const prefixEnv = process.env.MCP_PROXY_ALLOWED_PREFIXES;
  const allowlist = typeof prefixEnv === "string" && prefixEnv.trim().length > 0
    ? prefixEnv.split(",").map((value) => value.trim()).filter((value) => value.length > 0)
    : ["node", "npx", "uvx", "python", "python3", "bun", "deno"];

  return {
    proxyCommand,
    transport: "stdio",
    serverProfileId: process.env.MCP_PROXY_SERVER_PROFILE_ID ?? "default-stdio-profile",
    tenantId: process.env.MCP_PROXY_TENANT_ID ?? "proxy-tenant",
    allowedCommandPrefixes: allowlist,
    maxRestarts: parseNumberEnv(process.env.MCP_PROXY_MAX_RESTARTS, 3),
    restartBackoffMs: parseNumberEnv(process.env.MCP_PROXY_RESTART_BACKOFF_MS, 1000),
    killTimeoutMs: parseNumberEnv(process.env.MCP_PROXY_KILL_TIMEOUT_MS, 3000)
  };
}

function parseNumberEnv(raw: string | undefined, fallback: number): number {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function runFileMode(inputPath: string): number {
  try {
    const filePath = resolve(inputPath);
    const rawJson = readFileSync(filePath, "utf8");
    const input = JSON.parse(rawJson) as RawProxyInvocationV1;

    const report = runMcpMiddlewarePlatform(input);
    const summary = countCategories(report);

    console.log(`MCP Middleware Report
Invocation: ${report.invocationId}
Trace: ${report.traceId}
Final Status: ${report.finalStatus}
Passed: ${report.finalStatus === "served"}
Errors: ${summary.errorCount}
Warnings: ${summary.warningCount}
Categories: ${summary.categories.join(", ") || "none"}
HTTP Status: ${report.response.httpStatusCode}
Dispatched: ${report.response.dispatched}
Cost USD: ${report.cost.totalUsd}
Tokens: ${report.cost.totalTokens}`);

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed: ${message}`);
    return 1;
  }
}

function main(): number | null {
  const args = parseArgs(process.argv.slice(2));
  const hasProxyMode = args.stdioMode || typeof args.proxyCommand === "string";

  if (hasProxyMode) {
    if (!args.stdioMode) {
      console.error("Failed: proxy mode currently requires --stdio");
      return 1;
    }
    if (!args.proxyCommand || args.proxyCommand.trim().length === 0) {
      usage();
      return 1;
    }
    
    // Load policy file if provided
    let policyConfig: Record<string, unknown> | undefined;
    if (args.policyFile) {
      try {
        const policyContent = readFileSync(resolve(args.policyFile), "utf8");
        policyConfig = JSON.parse(policyContent);
        console.error(`Loaded policy from: ${args.policyFile}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to load policy file: ${errMsg}`);
        return 1;
      }
    }
    
    const startupCode = runStdioProxy(args.proxyCommand, policyConfig);
    return startupCode === 0 ? null : startupCode;
  }

  if (!args.inputPath) {
    usage();
    return 1;
  }

  return runFileMode(args.inputPath);
}

const exitCode = main();
if (exitCode !== null) {
  process.exit(exitCode);
}
