import type { NormalizedProxyContextV1, RawProxyInvocationV1 } from "../artifacts";
import { createHash } from "node:crypto";

const EMPTY_OBJECT: Record<string, unknown> = {};

const compareAsc = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  const valueType = typeof value;

  if (valueType === "string") {
    return JSON.stringify(value);
  }

  if (valueType === "number") {
    return Number.isFinite(value as number) ? JSON.stringify(value) : "null";
  }

  if (valueType === "boolean") {
    return value ? "true" : "false";
  }

  if (valueType === "bigint") {
    return JSON.stringify((value as bigint).toString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (valueType !== "object") {
    return "null";
  }

  const recordValue = value as Record<string, unknown>;
  const keys = Object.keys(recordValue).sort(compareAsc);

  const entries: string[] = [];
  for (const key of keys) {
    const item = recordValue[key];
    const itemType = typeof item;
    if (itemType === "undefined" || itemType === "function" || itemType === "symbol") {
      continue;
    }
    entries.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
  }

  return `{${entries.join(",")}}`;
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

const normalizeScopes = (scopes: unknown): string[] => {
  if (!Array.isArray(scopes)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const scope of scopes) {
    if (typeof scope !== "string") {
      continue;
    }

    const normalized = scope.trim().toLowerCase();
    if (normalized.length > 0) {
      deduped.add(normalized);
    }
  }

  return [...deduped].sort(compareAsc);
};

const normalizePayload = (argumentsValue: unknown): Record<string, unknown> => {
  if (!isRecord(argumentsValue)) {
    return EMPTY_OBJECT;
  }

  return { ...argumentsValue };
};

const safeString = (value: unknown): string => (typeof value === "string" ? value : "");
const safeNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * Canonicalizes the inbound MCP invocation into a deterministic execution context.
 * Never throws; returns a deterministic fallback on malformed input.
 */
export const normalizeRequest = (input: RawProxyInvocationV1): NormalizedProxyContextV1 => {
  try {
    const invocationId =
      typeof input.invocationIdHint === "string" && input.invocationIdHint.length > 0
        ? sha256(`${input.invocationIdHint}${canonicalJson(input.envelope.requestId)}`)
        : sha256(canonicalJson({ envelope: input.envelope, context: input.context }));

    const traceId = sha256(`${invocationId}${input.envelope.method}${input.envelope.toolCall.toolName}`);

    const policyRules = [...input.policyRules].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return compareAsc(left.ruleId, right.ruleId);
    });

    const rateLimitRules = [...input.rateLimitRules].sort((left, right) => {
      const byDimension = compareAsc(left.dimension, right.dimension);
      if (byDimension !== 0) {
        return byDimension;
      }

      if (left.windowSeconds !== right.windowSeconds) {
        return left.windowSeconds - right.windowSeconds;
      }

      if (left.limit !== right.limit) {
        return left.limit - right.limit;
      }

      return compareAsc(left.ruleId, right.ruleId);
    });

    const toolCatalog = [...input.toolCatalog].sort((left, right) => {
      const byServer = compareAsc(left.serverId, right.serverId);
      if (byServer !== 0) {
        return byServer;
      }
      return compareAsc(left.toolName, right.toolName);
    });

    const redactionRules = [...input.redactionRules].sort((left, right) => {
      const byRuleId = compareAsc(left.ruleId, right.ruleId);
      if (byRuleId !== 0) {
        return byRuleId;
      }
      return compareAsc(left.matchPath, right.matchPath);
    });

    return {
      invocationId,
      traceId,
      normalizedMethod: safeString(input.envelope.method).toLowerCase(),
      normalizedToolName: safeString(input.envelope.toolCall.toolName).toLowerCase(),
      tenantId: safeString(input.context.tenantId),
      userId: safeString(input.context.userId),
      agentId: safeString(input.context.agentId),
      scopes: normalizeScopes(input.context.scopes),
      requestPayload: normalizePayload(input.envelope.toolCall.arguments),
      requestTokenEstimate: safeNumber(input.usageSnapshot.tokenEstimateInput),
      responseTokenEstimate: safeNumber(input.usageSnapshot.tokenEstimateOutput),
      policyRules,
      rateLimitRules,
      toolCatalog,
      redactionRules,
      pricing: input.pricing,
      historicalCallsInWindow: input.usageSnapshot.historicalCallsInWindow,
      windowStartEpochMs: safeNumber(input.usageSnapshot.windowStartEpochMs)
    };
  } catch {
    const fallbackInvocationId = sha256(canonicalJson(input));
    const fallbackTraceId = sha256(`${fallbackInvocationId}`);

    return {
      invocationId: fallbackInvocationId,
      traceId: fallbackTraceId,
      normalizedMethod: "",
      normalizedToolName: "",
      tenantId: "",
      userId: "",
      agentId: "",
      scopes: [],
      requestPayload: EMPTY_OBJECT,
      requestTokenEstimate: 0,
      responseTokenEstimate: 0,
      policyRules: [],
      rateLimitRules: [],
      toolCatalog: [],
      redactionRules: [],
      pricing: {
        inputTokenPriceUsd: 0,
        outputTokenPriceUsd: 0,
        requestBaseFeeUsd: 0
      },
      historicalCallsInWindow: {},
      windowStartEpochMs: 0
    };
  }
};
