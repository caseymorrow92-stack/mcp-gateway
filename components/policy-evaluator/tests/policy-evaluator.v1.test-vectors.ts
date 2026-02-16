import type {
  AuthEvaluationV1,
  CostPricingTable,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  PolicyRuleSnapshot
} from "../../artifacts";
import { COMPONENT_CONTRACT } from "../contract";

type ArtifactById = {
  NormalizedProxyContextV1: NormalizedProxyContextV1;
  AuthEvaluationV1: AuthEvaluationV1;
  PolicyEvaluationV1: PolicyEvaluationV1;
};

type ContractInputIds = (typeof COMPONENT_CONTRACT.inputs)[number];
type ContractOutputIds = (typeof COMPONENT_CONTRACT.outputs)[number];

type PolicyEvaluatorInput = {
  normalized: ArtifactById[Extract<ContractInputIds, "NormalizedProxyContextV1">];
  auth: ArtifactById[Extract<ContractInputIds, "AuthEvaluationV1">];
};

type PolicyEvaluatorOutput = ArtifactById[Extract<ContractOutputIds, "PolicyEvaluationV1">];

type PolicyEvaluatorTestVector = {
  name: string;
  input: PolicyEvaluatorInput;
  expected: PolicyEvaluatorOutput;
};

const toBytes = (input: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
        i += 1;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
};

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

const sha256Hex = (input: string): string => {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bytes = toBytes(input);
  const bitLength = bytes.length * 8;
  const bitLengthHi = Math.floor(bitLength / 0x100000000);
  const bitLengthLo = bitLength >>> 0;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }
  for (let i = 3; i >= 0; i -= 1) {
    bytes.push((bitLengthHi >>> (i * 8)) & 0xff);
  }
  for (let i = 3; i >= 0; i -= 1) {
    bytes.push((bitLengthLo >>> (i * 8)) & 0xff);
  }

  for (let i = 0; i < bytes.length; i += 64) {
    const w: number[] = new Array(64);
    for (let t = 0; t < 16; t += 1) {
      const j = i + (t * 4);
      w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let z = h[7];

    for (let t = 0; t < 64; t += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (z + s1 + ch + k[t] + w[t]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;

      z = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + z) >>> 0;
  }

  let out = "";
  for (let i = 0; i < h.length; i += 1) {
    out += (`00000000${h[i].toString(16)}`).slice(-8);
  }
  return out;
};

const hashDecisionId = (invocationId: string, status: PolicyEvaluationV1["status"], deniedReasonCode?: string): string =>
  sha256Hex(`${invocationId}policy${status}${deniedReasonCode ?? "none"}`);

const BASE_PRICING: CostPricingTable = {
  inputTokenPriceUsd: 0.000001,
  outputTokenPriceUsd: 0.000002,
  requestBaseFeeUsd: 0.0001
};

const BASE_NORMALIZED: NormalizedProxyContextV1 = {
  invocationId: "inv-001",
  traceId: "trace-001",
  normalizedMethod: "tools/call",
  normalizedToolName: "search_docs",
  tenantId: "tenant-1",
  userId: "user-1",
  agentId: "agent-1",
  scopes: ["scope:read", "scope:tools:invoke"],
  requestPayload: { serverId: "server-alpha", arguments: { q: "policy" } },
  requestTokenEstimate: 123,
  responseTokenEstimate: 45,
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: BASE_PRICING,
  historicalCallsInWindow: {},
  windowStartEpochMs: 1700000000000
};

const AUTH_ALLOW: AuthEvaluationV1 = {
  decisionId: "auth-allow",
  authenticated: true,
  status: "allow",
  principal: {
    tenantId: "tenant-1",
    userId: "user-1",
    agentId: "agent-1",
    effectiveScopes: ["scope:read", "scope:tools:invoke"]
  },
  failedChecks: [],
  reasonCode: "ok"
};

const AUTH_DENY: AuthEvaluationV1 = {
  ...AUTH_ALLOW,
  decisionId: "auth-deny",
  authenticated: false,
  status: "deny",
  failedChecks: ["token-expired"],
  reasonCode: "token-expired"
};

const RULES_MIXED: PolicyRuleSnapshot[] = [
  {
    ruleId: "z-transform",
    stage: "policy",
    status: "transform",
    conditionDsl: "tool:search_docs",
    reasonCode: "add-policy-marker",
    priority: 20
  },
  {
    ruleId: "a-deny",
    stage: "dispatch",
    status: "deny",
    conditionDsl: "server-alpha",
    reasonCode: "server-denied",
    priority: 20
  },
  {
    ruleId: "observe-1",
    stage: "request-redaction",
    status: "observe-only",
    conditionDsl: "scope:tools:invoke",
    reasonCode: "audit-observe",
    priority: 5
  },
  {
    ruleId: "ignored-auth",
    stage: "authenticate",
    status: "deny",
    conditionDsl: "*",
    reasonCode: "must-be-ignored",
    priority: 999
  }
];

export const TEST_VECTORS: PolicyEvaluatorTestVector[] = [
  {
    name: "happy path: transform rule applies via tool name",
    input: {
      normalized: {
        ...BASE_NORMALIZED,
        invocationId: "inv-transform",
        policyRules: [
          {
            ruleId: "transform-tool",
            stage: "policy",
            status: "transform",
            conditionDsl: "tool=search_docs",
            reasonCode: "transform-request",
            priority: 10
          }
        ]
      },
      auth: AUTH_ALLOW
    },
    expected: {
      decisionId: hashDecisionId("inv-transform", "transform"),
      status: "transform",
      applicableRules: [
        {
          ruleId: "transform-tool",
          stage: "policy",
          status: "transform",
          reasonCode: "transform-request",
          priority: 10
        }
      ],
      transformPatches: [
        {
          path: "$.arguments",
          op: "set",
          value: { policyRuleId: "transform-tool" }
        }
      ]
    }
  },
  {
    name: "empty/minimal policy set returns allow",
    input: {
      normalized: {
        ...BASE_NORMALIZED,
        invocationId: "inv-empty",
        scopes: [],
        policyRules: []
      },
      auth: AUTH_ALLOW
    },
    expected: {
      decisionId: hashDecisionId("inv-empty", "allow"),
      status: "allow",
      applicableRules: [],
      transformPatches: []
    }
  },
  {
    name: "auth denied short-circuits with deterministic reason",
    input: {
      normalized: {
        ...BASE_NORMALIZED,
        invocationId: "inv-auth-deny",
        policyRules: RULES_MIXED
      },
      auth: AUTH_DENY
    },
    expected: {
      decisionId: hashDecisionId("inv-auth-deny", "deny", "auth-precondition-failed"),
      status: "deny",
      applicableRules: [],
      transformPatches: [],
      deniedReasonCode: "auth-precondition-failed"
    }
  },
  {
    name: "edge case: mixed deny and transform rules, deny wins by ordered first deny reason",
    input: {
      normalized: {
        ...BASE_NORMALIZED,
        invocationId: "inv-mixed",
        policyRules: RULES_MIXED
      },
      auth: AUTH_ALLOW
    },
    expected: {
      decisionId: hashDecisionId("inv-mixed", "deny", "server-denied"),
      status: "deny",
      applicableRules: [
        {
          ruleId: "a-deny",
          stage: "dispatch",
          status: "deny",
          reasonCode: "server-denied",
          priority: 20
        },
        {
          ruleId: "z-transform",
          stage: "policy",
          status: "transform",
          reasonCode: "add-policy-marker",
          priority: 20
        },
        {
          ruleId: "observe-1",
          stage: "request-redaction",
          status: "observe-only",
          reasonCode: "audit-observe",
          priority: 5
        }
      ],
      transformPatches: [
        {
          path: "$.arguments",
          op: "set",
          value: { policyRuleId: "z-transform" }
        }
      ],
      deniedReasonCode: "server-denied"
    }
  },
  {
    name: "edge case: wildcard rule applies when no direct tool/server/scope token matches",
    input: {
      normalized: {
        ...BASE_NORMALIZED,
        invocationId: "inv-wildcard",
        normalizedToolName: "different_tool",
        requestPayload: { serverId: "server-beta", arguments: {} },
        scopes: ["scope:none"],
        policyRules: [
          {
            ruleId: "wild-observe",
            stage: "response-redaction",
            status: "observe-only",
            conditionDsl: "if * then audit",
            reasonCode: "wildcard-observe",
            priority: 1
          }
        ]
      },
      auth: AUTH_ALLOW
    },
    expected: {
      decisionId: hashDecisionId("inv-wildcard", "observe-only"),
      status: "observe-only",
      applicableRules: [
        {
          ruleId: "wild-observe",
          stage: "response-redaction",
          status: "observe-only",
          reasonCode: "wildcard-observe",
          priority: 1
        }
      ],
      transformPatches: []
    }
  }
];
