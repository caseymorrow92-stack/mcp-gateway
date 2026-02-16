import type {
  AuthEvaluationV1,
  DecisionStatus,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RateLimitDecisionV1,
  RedactedRequestV1
} from "../../artifacts";
import { dispatchUpstream } from "../index";

type UpstreamDispatcherInput = Parameters<typeof dispatchUpstream>[0];
type UpstreamDispatcherOutput = ReturnType<typeof dispatchUpstream>;

type BlockedStage = "authenticate" | "policy" | "rate-limit" | "request-redaction";

export type UpstreamDispatcherTestVector = {
  name: string;
  input: UpstreamDispatcherInput;
  expected: UpstreamDispatcherOutput;
};

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

const BASE_CONTEXT: NormalizedProxyContextV1 = {
  invocationId: "inv-001",
  traceId: "trace-001",
  normalizedMethod: "tools/call",
  normalizedToolName: "lookup-user",
  tenantId: "tenant-a",
  userId: "user-a",
  agentId: "agent-a",
  scopes: ["tools:read"],
  requestPayload: { query: "alpha" },
  requestTokenEstimate: 150,
  responseTokenEstimate: 320,
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: {
    inputTokenPriceUsd: 0.000001,
    outputTokenPriceUsd: 0.000002,
    requestBaseFeeUsd: 0.001
  },
  historicalCallsInWindow: {},
  windowStartEpochMs: 1700000000000
};

const BASE_AUTH: AuthEvaluationV1 = {
  decisionId: "auth-001",
  authenticated: true,
  status: "allow",
  principal: {
    tenantId: "tenant-a",
    userId: "user-a",
    agentId: "agent-a",
    effectiveScopes: ["tools:read"]
  },
  failedChecks: [],
  reasonCode: "AUTH_OK"
};

const BASE_POLICY: PolicyEvaluationV1 = {
  decisionId: "policy-001",
  status: "allow",
  applicableRules: [],
  transformPatches: []
};

const BASE_RATE_LIMIT: RateLimitDecisionV1 = {
  decisionId: "rl-001",
  status: "allow",
  allowed: true,
  retryAfterSeconds: 0,
  appliedRules: []
};

const BASE_REDACTED_REQUEST: RedactedRequestV1 = {
  decisionId: "rr-001",
  status: "allow",
  serverId: "crm-server",
  toolName: "lookup-user",
  arguments: {
    userId: "u-1",
    includeHistory: false
  },
  redactionEvents: []
};

function buildInput(overrides?: Partial<UpstreamDispatcherInput>): UpstreamDispatcherInput {
  return {
    normalizedContext: overrides?.normalizedContext ?? BASE_CONTEXT,
    authEvaluation: overrides?.authEvaluation ?? BASE_AUTH,
    policyEvaluation: overrides?.policyEvaluation ?? BASE_POLICY,
    rateLimitDecision: overrides?.rateLimitDecision ?? BASE_RATE_LIMIT,
    redactedRequest: overrides?.redactedRequest ?? BASE_REDACTED_REQUEST
  };
}

function expectedAllow(input: UpstreamDispatcherInput): UpstreamDispatcherOutput {
  const requestTokenEstimate = typeof input.normalizedContext.requestTokenEstimate === "number"
    ? input.normalizedContext.requestTokenEstimate
    : 0;
  const upstreamLatencyMs = Math.round(Math.min(2000, 5 + requestTokenEstimate / 10));
  const status: DecisionStatus = "allow";
  const httpStatusCode = 200;

  return {
    decisionId: deriveDecisionId(input.normalizedContext.invocationId, status, httpStatusCode),
    status,
    dispatched: true,
    httpStatusCode,
    upstreamLatencyMs,
    upstreamResponse: {
      result: {
        arguments: input.redactedRequest.arguments,
        serverId: input.redactedRequest.serverId,
        toolName: input.redactedRequest.toolName
      }
    }
  };
}

function expectedBlocked(input: UpstreamDispatcherInput, stage: BlockedStage): UpstreamDispatcherOutput {
  const status: DecisionStatus = "deny";
  const httpStatusCode = stage === "rate-limit" ? 429 : 403;
  const error = BLOCKED_STAGE_ERRORS[stage];

  return {
    decisionId: deriveDecisionId(input.normalizedContext.invocationId, status, httpStatusCode),
    status,
    dispatched: false,
    blockedByStage: stage,
    httpStatusCode,
    upstreamLatencyMs: 0,
    upstreamResponse: {
      error: {
        code: error.code,
        message: error.message
      }
    }
  };
}

function deriveDecisionId(invocationId: string, status: DecisionStatus, httpStatusCode: number): string {
  return sha256Hex(`${invocationId}dispatch${status}${String(httpStatusCode)}`);
}

export const TEST_VECTORS: UpstreamDispatcherTestVector[] = [
  {
    name: "happy path dispatches with deterministic synthetic upstream result",
    input: buildInput(),
    expected: expectedAllow(buildInput())
  },
  {
    name: "empty request payload still dispatches when not blocked",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-empty-payload",
        requestPayload: {}
      },
      redactedRequest: {
        ...BASE_REDACTED_REQUEST,
        arguments: {}
      }
    }),
    expected: expectedAllow(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-empty-payload",
          requestPayload: {}
        },
        redactedRequest: {
          ...BASE_REDACTED_REQUEST,
          arguments: {}
        }
      })
    )
  },
  {
    name: "minimal blocked auth input returns deny with only error payload",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-auth-blocked",
        requestTokenEstimate: 0
      },
      authEvaluation: {
        ...BASE_AUTH,
        authenticated: false,
        status: "deny",
        failedChecks: ["missing-scope"],
        reasonCode: "AUTH_MISSING_SCOPE"
      }
    }),
    expected: expectedBlocked(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-auth-blocked",
          requestTokenEstimate: 0
        },
        authEvaluation: {
          ...BASE_AUTH,
          authenticated: false,
          status: "deny",
          failedChecks: ["missing-scope"],
          reasonCode: "AUTH_MISSING_SCOPE"
        }
      }),
      "authenticate"
    )
  },
  {
    name: "policy deny blocks at policy stage with 403",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-policy-blocked"
      },
      policyEvaluation: {
        ...BASE_POLICY,
        status: "deny",
        deniedReasonCode: "POLICY_DENY_MATCH"
      }
    }),
    expected: expectedBlocked(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-policy-blocked"
        },
        policyEvaluation: {
          ...BASE_POLICY,
          status: "deny",
          deniedReasonCode: "POLICY_DENY_MATCH"
        }
      }),
      "policy"
    )
  },
  {
    name: "rate-limit deny blocks with 429",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-rate-limit-blocked"
      },
      rateLimitDecision: {
        ...BASE_RATE_LIMIT,
        status: "deny",
        allowed: false,
        retryAfterSeconds: 30,
        deniedReasonCode: "RATE_LIMIT_EXCEEDED"
      }
    }),
    expected: expectedBlocked(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-rate-limit-blocked"
        },
        rateLimitDecision: {
          ...BASE_RATE_LIMIT,
          status: "deny",
          allowed: false,
          retryAfterSeconds: 30,
          deniedReasonCode: "RATE_LIMIT_EXCEEDED"
        }
      }),
      "rate-limit"
    )
  },
  {
    name: "request redaction deny blocks at request-redaction stage",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-request-redaction-blocked"
      },
      redactedRequest: {
        ...BASE_REDACTED_REQUEST,
        status: "deny"
      }
    }),
    expected: expectedBlocked(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-request-redaction-blocked"
        },
        redactedRequest: {
          ...BASE_REDACTED_REQUEST,
          status: "deny"
        }
      }),
      "request-redaction"
    )
  },
  {
    name: "conflicting blocker states use first blocker in order",
    input: buildInput({
      normalizedContext: {
        ...BASE_CONTEXT,
        invocationId: "inv-conflicting-blockers"
      },
      authEvaluation: {
        ...BASE_AUTH,
        authenticated: false,
        status: "deny",
        failedChecks: ["token-expired"],
        reasonCode: "AUTH_TOKEN_EXPIRED"
      },
      policyEvaluation: {
        ...BASE_POLICY,
        status: "deny",
        deniedReasonCode: "POLICY_DENY_MATCH"
      },
      rateLimitDecision: {
        ...BASE_RATE_LIMIT,
        status: "deny",
        allowed: false,
        deniedReasonCode: "RATE_LIMIT_EXCEEDED"
      },
      redactedRequest: {
        ...BASE_REDACTED_REQUEST,
        status: "deny"
      }
    }),
    expected: expectedBlocked(
      buildInput({
        normalizedContext: {
          ...BASE_CONTEXT,
          invocationId: "inv-conflicting-blockers"
        },
        authEvaluation: {
          ...BASE_AUTH,
          authenticated: false,
          status: "deny",
          failedChecks: ["token-expired"],
          reasonCode: "AUTH_TOKEN_EXPIRED"
        },
        policyEvaluation: {
          ...BASE_POLICY,
          status: "deny",
          deniedReasonCode: "POLICY_DENY_MATCH"
        },
        rateLimitDecision: {
          ...BASE_RATE_LIMIT,
          status: "deny",
          allowed: false,
          deniedReasonCode: "RATE_LIMIT_EXCEEDED"
        },
        redactedRequest: {
          ...BASE_REDACTED_REQUEST,
          status: "deny"
        }
      }),
      "authenticate"
    )
  }
];

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
  for (let i = 0; i < values.length; i += 1) {
    result = (result + values[i]) >>> 0;
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
