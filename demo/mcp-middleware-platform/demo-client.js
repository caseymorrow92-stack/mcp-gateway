#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

function parseArgs(argv) {
  const result = {
    proxyCommand: "",
    scenario: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--proxy-command") {
      const next = argv[i + 1];
      if (typeof next === "string" && next.length > 0) {
        result.proxyCommand = next;
        i += 1;
      }
      continue;
    }
    if (token === "--scenario") {
      const next = argv[i + 1];
      if (typeof next === "string" && next.length > 0) {
        result.scenario = next;
        i += 1;
      }
    }
  }

  if (!result.proxyCommand) {
    result.proxyCommand = buildDefaultProxyCommand(result.scenario);
  }

  return result;
}

function buildDefaultProxyCommand(scenarioName) {
  const localTsx = "./node_modules/.bin/tsx";
  const tsxCommand = existsSync(localTsx) ? localTsx : "npx --yes tsx";
  const policyFlag = scenarioName
    ? ` --policy-file \"demo/mcp-middleware-platform/scenarios/${scenarioName}.json\"`
    : "";
  return `${tsxCommand} ./cli.ts --proxy \"node demo/mcp-middleware-platform/simple-mcp-server.js\" --stdio${policyFlag}`;
}

function frameMessage(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  return Buffer.concat([header, body]);
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function logRequest(label, payload) {
  console.log(`\n[client -> proxy] ${label}`);
  console.log(pretty(payload));
}

function logResponse(label, payload) {
  console.log(`\n[proxy -> client] ${label}`);
  console.log(pretty(payload));
}

function createFrameParser(onMessage) {
  let pending = Buffer.alloc(0);

  return (chunk) => {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    pending = Buffer.concat([pending, chunkBuffer]);

    while (true) {
      const headerBoundary = pending.indexOf("\r\n\r\n");
      if (headerBoundary < 0) {
        return;
      }

      const header = pending.slice(0, headerBoundary).toString("utf8");
      const match = header.match(/content-length:\s*(\d+)/i);
      if (!match) {
        pending = Buffer.alloc(0);
        return;
      }

      const length = Number.parseInt(match[1], 10);
      if (!Number.isFinite(length) || length < 0) {
        pending = Buffer.alloc(0);
        return;
      }

      const bodyStart = headerBoundary + 4;
      const bodyEnd = bodyStart + length;
      if (pending.length < bodyEnd) {
        return;
      }

      const body = pending.slice(bodyStart, bodyEnd).toString("utf8");
      pending = pending.slice(bodyEnd);

      try {
        const message = JSON.parse(body);
        onMessage(message);
      } catch {
        // ignore malformed response in demo client
      }
    }
  };
}

function send(child, message) {
  child.stdin.write(frameMessage(message));
}

function waitForResponse(waiters, id, timeoutMs, getProxyExitMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`timeout waiting for response id=${id}`));
    }, timeoutMs);

    const exitPoll = setInterval(() => {
      const exitMessage = getProxyExitMessage();
      if (!exitMessage) {
        return;
      }
      clearInterval(exitPoll);
      clearTimeout(timeout);
      waiters.delete(id);
      reject(new Error(exitMessage));
    }, 100);

    waiters.set(id, (message) => {
      clearTimeout(timeout);
      clearInterval(exitPoll);
      resolve(message);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const shell = process.env.SHELL && process.env.SHELL.length > 0 ? process.env.SHELL : "/bin/sh";
  const startedAt = Date.now();

  section("MCP Middleware Platform Demo");
  console.log("This walkthrough starts a proxy, performs MCP handshake, lists tools, and calls one tool.");
  console.log("\nProxy command:");
  console.log(`  ${args.proxyCommand}`);

  const child = spawn(shell, ["-lc", args.proxyCommand], {
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      MCP_PROXY_ALLOWED_PREFIXES: process.env.MCP_PROXY_ALLOWED_PREFIXES || "node,npx",
      MCP_PROXY_MAX_RESTARTS: process.env.MCP_PROXY_MAX_RESTARTS || "2",
      MCP_PROXY_RESTART_BACKOFF_MS: process.env.MCP_PROXY_RESTART_BACKOFF_MS || "500",
      MCP_PROXY_KILL_TIMEOUT_MS: process.env.MCP_PROXY_KILL_TIMEOUT_MS || "1000"
    }
  });

  const waiters = new Map();
  let proxyExitMessage = null;
  child.once("exit", (code, signal) => {
    proxyExitMessage = signal ? `proxy exited via signal ${signal}` : `proxy exited with code ${String(code)}`;
  });

  const parse = createFrameParser((message) => {
    const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;
    if (typeof id !== "undefined" && waiters.has(id)) {
      const resolve = waiters.get(id);
      waiters.delete(id);
      resolve(message);
    }
  });

  child.stdout.on("data", parse);
  const responseTimeoutMs = 120000;

  try {
    section("1) Initialize Session");
    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-01-01",
        capabilities: {},
        clientInfo: { name: "demo-client", version: "1.0.0" }
      }
    };
    logRequest("initialize", initializeRequest);
    send(child, initializeRequest);

    const initResponse = await waitForResponse(waiters, 1, responseTimeoutMs, () => proxyExitMessage);
    logResponse("initialize", initResponse);

    section("2) Confirm Client Ready");
    send(child, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    });
    console.log("[client -> proxy] notifications/initialized");

    section("3) Discover Tools");
    const listToolsRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };
    logRequest("tools/list", listToolsRequest);
    send(child, listToolsRequest);

    const listResponse = await waitForResponse(waiters, 2, responseTimeoutMs, () => proxyExitMessage);
    logResponse("tools/list", listResponse);

    section("4) Call Tool");
    const callToolRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "echo.uppercase",
        arguments: {
          text: "hello through proxy"
        }
      }
    };
    logRequest("tools/call", callToolRequest);
    send(child, callToolRequest);

    const callResponse = await waitForResponse(waiters, 3, responseTimeoutMs, () => proxyExitMessage);
    logResponse("tools/call", callResponse);

    const tools = listResponse && listResponse.result && Array.isArray(listResponse.result.tools)
      ? listResponse.result.tools
      : [];
    const callContent = callResponse
      && callResponse.result
      && Array.isArray(callResponse.result.content)
      && callResponse.result.content[0]
      && typeof callResponse.result.content[0].text === "string"
      ? callResponse.result.content[0].text
      : "(no text)";

    section("Summary");
    console.log(`Handshake completed: yes`);
    console.log(`Tools discovered: ${tools.length}`);
    console.log(`Tool result: ${callContent}`);
    console.log(`Elapsed: ${Date.now() - startedAt}ms`);

    child.kill("SIGTERM");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    section("Failure");
    console.error(`Demo failed: ${message}`);
    child.kill("SIGTERM");
    process.exitCode = 1;
  }
}

main();
