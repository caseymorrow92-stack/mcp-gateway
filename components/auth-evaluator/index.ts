import type { AuthEvaluationV1, NormalizedProxyContextV1 } from "../artifacts";

declare const require: (id: string) => {
  createHash: (algorithm: string) => {
    update: (value: string) => { digest: (encoding: "hex") => string };
  };
};

const { createHash } = require("node:crypto");

const STAGE = "authenticate";

function toSha256(value: string): string {
  try {
    return createHash("sha256").update(value).digest("hex");
  } catch {
    return "0000000000000000000000000000000000000000000000000000000000000000";
  }
}

function normalizeIdentity(value: string): string {
  return value.trim();
}

function lexicographicSort(values: string[]): void {
  values.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function computeReasonCode(failedChecks: string[], authenticated: boolean): AuthEvaluationV1["reasonCode"] {
  if (authenticated) {
    return "auth-ok";
  }

  const hasMissingPrincipal = failedChecks.includes("missing-tenant")
    || failedChecks.includes("missing-user")
    || failedChecks.includes("missing-agent");

  if (hasMissingPrincipal) {
    return "auth-missing-principal";
  }

  return "auth-missing-scopes";
}

export function evaluateAuth(
  input: NormalizedProxyContextV1
): AuthEvaluationV1 {
  try {
    const tenantId = normalizeIdentity(input.tenantId);
    const userId = normalizeIdentity(input.userId);
    const agentId = normalizeIdentity(input.agentId);

    const failedChecks: string[] = [];

    if (tenantId.length === 0) {
      failedChecks.push("missing-tenant");
    }

    if (userId.length === 0) {
      failedChecks.push("missing-user");
    }

    if (agentId.length === 0) {
      failedChecks.push("missing-agent");
    }

    if (input.scopes.length === 0) {
      failedChecks.push("missing-scopes");
    }

    lexicographicSort(failedChecks);

    const authenticated = failedChecks.length === 0;
    const status: AuthEvaluationV1["status"] = authenticated ? "allow" : "deny";
    const reasonCode = computeReasonCode(failedChecks, authenticated);
    const decisionId = toSha256(`${input.invocationId}${STAGE}${status}${reasonCode}`);

    return {
      decisionId,
      authenticated,
      status,
      principal: {
        tenantId,
        userId,
        agentId,
        effectiveScopes: [...input.scopes]
      },
      failedChecks,
      reasonCode
    };
  } catch {
    const tenantId = typeof input?.tenantId === "string" ? normalizeIdentity(input.tenantId) : "";
    const userId = typeof input?.userId === "string" ? normalizeIdentity(input.userId) : "";
    const agentId = typeof input?.agentId === "string" ? normalizeIdentity(input.agentId) : "";
    const effectiveScopes = isStringArray(input?.scopes) ? [...input.scopes] : [];
    const failedChecks: string[] = [];

    if (tenantId.length === 0) {
      failedChecks.push("missing-tenant");
    }

    if (userId.length === 0) {
      failedChecks.push("missing-user");
    }

    if (agentId.length === 0) {
      failedChecks.push("missing-agent");
    }

    if (effectiveScopes.length === 0) {
      failedChecks.push("missing-scopes");
    }

    lexicographicSort(failedChecks);
    const authenticated = failedChecks.length === 0;
    const status: AuthEvaluationV1["status"] = authenticated ? "allow" : "deny";
    const reasonCode = computeReasonCode(failedChecks, authenticated);

    return {
      decisionId: toSha256(`${typeof input?.invocationId === "string" ? input.invocationId : ""}${STAGE}${status}${reasonCode}`),
      authenticated,
      status,
      principal: {
        tenantId,
        userId,
        agentId,
        effectiveScopes
      },
      failedChecks,
      reasonCode
    };
  }
}
