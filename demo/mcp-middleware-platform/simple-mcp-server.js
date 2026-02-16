#!/usr/bin/env node

const pending = {
  buffer: Buffer.alloc(0)
};

function writeFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  process.stdout.write(Buffer.concat([header, body]));
}

function response(id, result) {
  writeFrame({ jsonrpc: "2.0", id, result });
}

function error(id, code, message) {
  writeFrame({ jsonrpc: "2.0", id, error: { code, message } });
}

function handleMessage(message) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;
  const method = typeof message.method === "string" ? message.method : "";

  if (method === "initialize") {
    response(id, {
      protocolVersion: "2025-01-01",
      capabilities: {
        tools: { listChanged: false }
      },
      serverInfo: {
        name: "demo-mcp-server",
        version: "1.0.0"
      }
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    response(id, {
      tools: [
        {
          name: "echo.uppercase",
          description: "Uppercase input text",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string" }
            },
            required: ["text"],
            additionalProperties: false
          }
        }
      ]
    });
    return;
  }

  if (method === "tools/call") {
    const params = message && typeof message.params === "object" && message.params !== null ? message.params : {};
    const toolName = typeof params.name === "string" ? params.name : "";
    const argumentsValue =
      params.arguments && typeof params.arguments === "object" && params.arguments !== null
        ? params.arguments
        : {};

    if (toolName !== "echo.uppercase") {
      error(id, -32602, `Unknown tool: ${toolName}`);
      return;
    }

    const text = typeof argumentsValue.text === "string" ? argumentsValue.text : "";
    response(id, {
      content: [
        {
          type: "text",
          text: text.toUpperCase()
        }
      ],
      isError: false
    });
    return;
  }

  if (typeof id !== "undefined") {
    error(id, -32601, `Method not found: ${method}`);
  }
}

function tryParseFrames() {
  while (true) {
    const headerBoundary = pending.buffer.indexOf("\r\n\r\n");
    if (headerBoundary < 0) {
      return;
    }

    const header = pending.buffer.slice(0, headerBoundary).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) {
      pending.buffer = Buffer.alloc(0);
      return;
    }

    const length = Number.parseInt(match[1], 10);
    if (!Number.isFinite(length) || length < 0) {
      pending.buffer = Buffer.alloc(0);
      return;
    }

    const bodyStart = headerBoundary + 4;
    const bodyEnd = bodyStart + length;
    if (pending.buffer.length < bodyEnd) {
      return;
    }

    const body = pending.buffer.slice(bodyStart, bodyEnd);
    pending.buffer = pending.buffer.slice(bodyEnd);

    try {
      const message = JSON.parse(body.toString("utf8"));
      if (message && typeof message === "object") {
        handleMessage(message);
      }
    } catch {
      // Ignore invalid payloads in demo server.
    }
  }
}

process.stdin.on("data", (chunk) => {
  const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
  pending.buffer = Buffer.concat([pending.buffer, chunkBuffer]);
  tryParseFrames();
});

process.stdin.on("end", () => {
  process.exit(0);
});
