import type {
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  ToolFilterDecisionV1,
  ToolVisibilityDecision
} from "../artifacts";

const STAGE_ID = "tool-filter";

function hashDecisionId(raw: string): string {
  try {
    return sha256(raw);
  } catch {
    return "";
  }
}

function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        i += 1;
      }
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return bytes;
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256(input: string): string {
  const h = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ];
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

  const bytes = utf8Bytes(input);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);

  while ((bytes.length + 8) % 64 !== 0) {
    bytes.push(0);
  }

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;

  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  const w = new Array<number>(64);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t += 1) {
      const j = i + t * 4;
      w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }

    for (let t = 16; t < 64; t += 1) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (((w[t - 16] + s0) >>> 0) + ((w[t - 7] + s1) >>> 0)) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let t = 0; t < 64; t += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((hh + s1) >>> 0) + ch) >>> 0) + ((k[t] + w[t]) >>> 0)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hh = g;
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
    h[7] = (h[7] + hh) >>> 0;
  }

  return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function compareAllowed(
  a: { serverId: string; toolName: string },
  b: { serverId: string; toolName: string }
): number {
  if (a.serverId < b.serverId) {
    return -1;
  }
  if (a.serverId > b.serverId) {
    return 1;
  }
  if (a.toolName < b.toolName) {
    return -1;
  }
  if (a.toolName > b.toolName) {
    return 1;
  }
  return 0;
}

function compareBlocked(a: ToolVisibilityDecision, b: ToolVisibilityDecision): number {
  if (a.reasonCode < b.reasonCode) {
    return -1;
  }
  if (a.reasonCode > b.reasonCode) {
    return 1;
  }
  if (a.serverId < b.serverId) {
    return -1;
  }
  if (a.serverId > b.serverId) {
    return 1;
  }
  if (a.toolName < b.toolName) {
    return -1;
  }
  if (a.toolName > b.toolName) {
    return 1;
  }
  return 0;
}

/**
 * Determine visible tools and selected tool executability under policy and scope constraints.
 */
export function toolVisibilityFilter(
  normalizedContext: NormalizedProxyContextV1,
  policyEvaluation: PolicyEvaluationV1
): ToolFilterDecisionV1 {
  try {
    const invocationId = typeof normalizedContext.invocationId === "string" ? normalizedContext.invocationId : "";
    const normalizedToolName =
      typeof normalizedContext.normalizedToolName === "string" ? normalizedContext.normalizedToolName : "";

    if (policyEvaluation.status === "deny") {
      const blockedTools: ToolVisibilityDecision[] = normalizedContext.toolCatalog
        .map((tool) => ({
          serverId: tool.serverId,
          toolName: tool.toolName,
          reasonCode: "policy-deny"
        }))
        .sort(compareBlocked);

      return {
        decisionId: hashDecisionId(`${invocationId}${STAGE_ID}deny${normalizedToolName}`),
        status: "deny",
        allowedTools: [],
        blockedTools,
        selectedToolAllowed: false
      };
    }

    const scopeSet = new Set(normalizedContext.scopes);
    const allowedTools: ToolFilterDecisionV1["allowedTools"] = [];
    const blockedTools: ToolVisibilityDecision[] = [];

    for (const tool of normalizedContext.toolCatalog) {
      if (tool.visibility === "private") {
        blockedTools.push({
          serverId: tool.serverId,
          toolName: tool.toolName,
          reasonCode: "tool-private"
        });
        continue;
      }

      const missingScope = tool.scopeRequirements.some((scope) => !scopeSet.has(scope));
      if (missingScope) {
        blockedTools.push({
          serverId: tool.serverId,
          toolName: tool.toolName,
          reasonCode: "missing-scope"
        });
        continue;
      }

      allowedTools.push({
        serverId: tool.serverId,
        toolName: tool.toolName,
        summarizedDescription: tool.description.slice(0, 120)
      });
    }

    allowedTools.sort(compareAllowed);
    blockedTools.sort(compareBlocked);

    const selectedServerId =
      typeof normalizedContext.requestPayload.serverId === "string" ? normalizedContext.requestPayload.serverId : "";

    const selectedToolAllowed = allowedTools.some(
      (tool) => tool.serverId === selectedServerId && tool.toolName.toLowerCase() === normalizedToolName
    );

    const status: ToolFilterDecisionV1["status"] = selectedToolAllowed ? "allow" : "deny";

    return {
      decisionId: hashDecisionId(`${invocationId}${STAGE_ID}${status}${normalizedToolName}`),
      status,
      allowedTools,
      blockedTools,
      selectedToolAllowed
    };
  } catch {
    const invocationId = typeof normalizedContext?.invocationId === "string" ? normalizedContext.invocationId : "";
    const normalizedToolName =
      typeof normalizedContext?.normalizedToolName === "string" ? normalizedContext.normalizedToolName : "";

    return {
      decisionId: hashDecisionId(`${invocationId}${STAGE_ID}deny${normalizedToolName}`),
      status: "deny",
      allowedTools: [],
      blockedTools: [],
      selectedToolAllowed: false
    };
  }
}
