import type {
  AuthEvaluationV1,
  DecisionStatus,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RateLimitDecisionV1,
  RedactedRequestV1,
  UpstreamExecutionResultV1
} from "../artifacts";

type UpstreamDispatcherInput = {
  normalizedContext: NormalizedProxyContextV1;
  authEvaluation: AuthEvaluationV1;
  policyEvaluation: PolicyEvaluationV1;
  rateLimitDecision: RateLimitDecisionV1;
  redactedRequest: RedactedRequestV1;
};

type BlockedStage = "authenticate" | "policy" | "rate-limit" | "request-redaction";

const BLOCKED_STAGE_ERRORS: Record<BlockedStage, { code: string; message: string }> = {
  authenticate: {
    code: "UPSTREAM_BLOCKED_AUTHENTICATE",
    message: "Dispatch blocked at authenticate stage."
  },
  policy: {
    code: "UPSTREAM_BLOCKED_POLICY",
    message: "Dispatch blocked at policy stage."
  },
  "rate-limit": {
    code: "UPSTREAM_BLOCKED_RATE_LIMIT",
    message: "Dispatch blocked at rate-limit stage."
  },
  "request-redaction": {
    code: "UPSTREAM_BLOCKED_REQUEST_REDACTION",
    message: "Dispatch blocked at request-redaction stage."
  }
};

/**
 * Produces a deterministic synthetic upstream execution result.
 * Never throws; returns a deny result on unexpected errors.
 */
export function dispatchUpstream(input: UpstreamDispatcherInput): UpstreamExecutionResultV1 {
  try {
    const blockedByStage = getBlockedStage(input);
    const isBlocked = blockedByStage !== undefined;
    const httpStatusCode = isBlocked && blockedByStage === "rate-limit" ? 429 : isBlocked ? 403 : 200;
    const status: DecisionStatus = isBlocked ? "deny" : "allow";
    const decisionId = deriveDecisionId(input.normalizedContext.invocationId, status, httpStatusCode);

    if (isBlocked) {
      const stageError = BLOCKED_STAGE_ERRORS[blockedByStage];
      return {
        decisionId,
        status: "deny",
        dispatched: false,
        blockedByStage,
        httpStatusCode,
        upstreamLatencyMs: 0,
        upstreamResponse: {
          error: {
            code: stageError.code,
            message: stageError.message
          }
        }
      };
    }

    const requestTokenEstimate =
      typeof input.normalizedContext.requestTokenEstimate === "number" && isFinite(input.normalizedContext.requestTokenEstimate)
        ? input.normalizedContext.requestTokenEstimate
        : 0;
    const upstreamLatencyMs = Math.round(Math.min(2000, 5 + requestTokenEstimate / 10));
    const orderedResult = sortObjectKeysLexically({
      serverId: input.redactedRequest.serverId,
      toolName: input.redactedRequest.toolName,
      arguments: input.redactedRequest.arguments
    });

    return {
      decisionId,
      status: "allow",
      dispatched: true,
      httpStatusCode: 200,
      upstreamLatencyMs,
      upstreamResponse: {
        result: orderedResult
      }
    };
  } catch {
    const fallbackInvocationId =
      input !== null &&
      typeof input === "object" &&
      "normalizedContext" in input &&
      input.normalizedContext !== null &&
      typeof input.normalizedContext === "object" &&
      "invocationId" in input.normalizedContext &&
      typeof input.normalizedContext.invocationId === "string"
        ? input.normalizedContext.invocationId
        : "unknown-invocation";
    const status: DecisionStatus = "deny";
    const httpStatusCode = 403;
    const decisionId = deriveDecisionId(fallbackInvocationId, status, httpStatusCode);

    return {
      decisionId,
      status,
      dispatched: false,
      blockedByStage: "policy",
      httpStatusCode,
      upstreamLatencyMs: 0,
      upstreamResponse: {
        error: {
          code: "UPSTREAM_DISPATCHER_INTERNAL_FALLBACK",
          message: "Dispatch blocked due to internal fallback."
        }
      }
    };
  }
}

function getBlockedStage(input: UpstreamDispatcherInput): BlockedStage | undefined {
  if (input.authEvaluation.status === "deny" || input.authEvaluation.authenticated === false) {
    return "authenticate";
  }
  if (input.policyEvaluation.status === "deny") {
    return "policy";
  }
  if (input.rateLimitDecision.status === "deny" || input.rateLimitDecision.allowed === false) {
    return "rate-limit";
  }
  if (input.redactedRequest.status === "deny") {
    return "request-redaction";
  }
  return undefined;
}

function deriveDecisionId(invocationId: string, status: DecisionStatus, httpStatusCode: number): string {
  const stableInvocationId = typeof invocationId === "string" ? invocationId : "unknown-invocation";
  return sha256Hex(`${stableInvocationId}dispatch${status}${String(httpStatusCode)}`);
}

function sortObjectKeysLexically(value: unknown): Record<string, unknown> {
  const sorted = sortValue(value);
  return isRecord(sorted) ? sorted : {};
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const keys = Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256Hex(input: string): string {
  const initialHash: number[] = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ];
  const constants: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const encoded = new TextEncoder().encode(input);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    bytes.push(encoded[i]);
  }
  const bitLength = bytes.length * 8;
  bytes.push(0x80);

  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;

  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  for (let i = 0; i < bytes.length; i += 64) {
    const words: number[] = [];
    for (let j = 0; j < 64; j += 1) {
      words.push(0);
    }

    for (let j = 0; j < 16; j += 1) {
      const offset = i + j * 4;
      words[j] =
        ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }

    for (let j = 16; j < 64; j += 1) {
      const s0 = rotr(words[j - 15], 7) ^ rotr(words[j - 15], 18) ^ (words[j - 15] >>> 3);
      const s1 = rotr(words[j - 2], 17) ^ rotr(words[j - 2], 19) ^ (words[j - 2] >>> 10);
      words[j] = add32(words[j - 16], s0, words[j - 7], s1);
    }

    let a = initialHash[0];
    let b = initialHash[1];
    let c = initialHash[2];
    let d = initialHash[3];
    let e = initialHash[4];
    let f = initialHash[5];
    let g = initialHash[6];
    let h = initialHash[7];

    for (let j = 0; j < 64; j += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, ch, constants[j], words[j]);
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, maj);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    initialHash[0] = add32(initialHash[0], a);
    initialHash[1] = add32(initialHash[1], b);
    initialHash[2] = add32(initialHash[2], c);
    initialHash[3] = add32(initialHash[3], d);
    initialHash[4] = add32(initialHash[4], e);
    initialHash[5] = add32(initialHash[5], f);
    initialHash[6] = add32(initialHash[6], g);
    initialHash[7] = add32(initialHash[7], h);
  }

  let output = "";
  for (let i = 0; i < initialHash.length; i += 1) {
    output += toHex8(initialHash[i]);
  }
  return output;
}

function rotr(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function add32(...values: number[]): number {
  let result = 0;
  for (const value of values) {
    result = (result + value) >>> 0;
  }
  return result;
}

function toHex8(value: number): string {
  const hex = (value >>> 0).toString(16);
  if (hex.length >= 8) {
    return hex;
  }
  return `${"00000000".slice(hex.length)}${hex}`;
}
