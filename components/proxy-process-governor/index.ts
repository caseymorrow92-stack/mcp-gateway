import type { ProxyProcessSpawnDecisionV1, ProxyProcessSpawnRequestV1 } from "../artifacts";
import { createHash } from "node:crypto";

const STAGE = "proxy-process-governor";

export function evaluateProxyProcessSpawn(request: ProxyProcessSpawnRequestV1): ProxyProcessSpawnDecisionV1 {
  try {
    const normalizedCommand = normalizeCommand(request.proxyCommand);
    const argv = normalizedCommand.length > 0 ? normalizedCommand.split(" ") : [];
    const prefixes = normalizePrefixes(request.allowedCommandPrefixes);

    const maxRestarts = clampInteger(request.maxRestarts, 0, 10);
    const restartBackoffMs = clampInteger(request.restartBackoffMs, 100, 60000);
    const killTimeoutMs = clampInteger(request.killTimeoutMs, 100, 120000);

    const isEmpty = normalizedCommand.length === 0 || argv.length === 0;
    const firstToken = argv[0] ?? "";
    const allowedPrefix = !isEmpty && prefixes.some((prefix) => isAllowedCommandToken(firstToken, prefix));

    const status: ProxyProcessSpawnDecisionV1["status"] = isEmpty || !allowedPrefix ? "deny" : "allow";
    const reasonCode = isEmpty
      ? "proxy-command-empty"
      : allowedPrefix
        ? "proxy-prefix-allowed"
        : "proxy-prefix-denied";

    return {
      decisionId: deriveDecisionId({
        normalizedCommand,
        prefixes,
        status,
        reasonCode,
        maxRestarts,
        restartBackoffMs,
        killTimeoutMs
      }),
      status,
      reasonCode,
      normalizedCommand,
      spawn: {
        allowed: status === "allow",
        argv,
        maxRestarts,
        restartBackoffMs,
        killTimeoutMs
      }
    };
  } catch {
    const normalizedCommand = normalizeCommand(request?.proxyCommand ?? "");
    const prefixes = normalizePrefixes(request?.allowedCommandPrefixes ?? []);
    const maxRestarts = clampInteger(request?.maxRestarts ?? 0, 0, 10);
    const restartBackoffMs = clampInteger(request?.restartBackoffMs ?? 1000, 100, 60000);
    const killTimeoutMs = clampInteger(request?.killTimeoutMs ?? 3000, 100, 120000);

    return {
      decisionId: deriveDecisionId({
        normalizedCommand,
        prefixes,
        status: "deny",
        reasonCode: "proxy-governor-fallback",
        maxRestarts,
        restartBackoffMs,
        killTimeoutMs
      }),
      status: "deny",
      reasonCode: "proxy-governor-fallback",
      normalizedCommand,
      spawn: {
        allowed: false,
        argv: normalizedCommand.length > 0 ? normalizedCommand.split(" ") : [],
        maxRestarts,
        restartBackoffMs,
        killTimeoutMs
      }
    };
  }
}

function normalizeCommand(value: string): string {
  const safe = typeof value === "string" ? value.trim() : "";
  if (safe.length === 0) {
    return "";
  }
  return safe.split(/\s+/).join(" ");
}

function normalizePrefixes(prefixes: string[]): string[] {
  const seen: Record<string, true> = {};
  const normalized: string[] = [];

  for (const prefix of prefixes) {
    const safe = typeof prefix === "string" ? prefix.trim().toLowerCase() : "";
    if (safe.length === 0 || seen[safe]) {
      continue;
    }
    seen[safe] = true;
    normalized.push(safe);
  }

  normalized.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return normalized;
}

function isAllowedCommandToken(commandToken: string, prefix: string): boolean {
  const token = commandToken.toLowerCase();
  const slashSuffix = `/${prefix}`;
  const backslashSuffix = `\\${prefix}`;
  return token === prefix || hasSuffix(token, slashSuffix) || hasSuffix(token, backslashSuffix);
}

function clampInteger(value: number, min: number, max: number): number {
  const safe = isFiniteNumber(value) ? truncateNumber(value) : min;
  if (safe < min) {
    return min;
  }
  if (safe > max) {
    return max;
  }
  return safe;
}

function hasSuffix(value: string, suffix: string): boolean {
  if (suffix.length > value.length) {
    return false;
  }
  return value.slice(value.length - suffix.length) === suffix;
}

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && isFinite(value);
}

function truncateNumber(value: number): number {
  if (value >= 0) {
    return Math.floor(value);
  }
  return Math.ceil(value);
}

function deriveDecisionId(input: {
  normalizedCommand: string;
  prefixes: string[];
  status: ProxyProcessSpawnDecisionV1["status"];
  reasonCode: string;
  maxRestarts: number;
  restartBackoffMs: number;
  killTimeoutMs: number;
}): string {
  const payload = [
    input.normalizedCommand,
    input.prefixes.join(","),
    input.status,
    input.reasonCode,
    String(input.maxRestarts),
    String(input.restartBackoffMs),
    String(input.killTimeoutMs),
    STAGE
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}
