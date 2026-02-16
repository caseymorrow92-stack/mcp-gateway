import type {
  DecisionStatus,
  PolicyEvaluationV1,
  RedactedResponseV1,
  RedactionEvent,
  UpstreamExecutionResultV1
} from "../artifacts";

const COMPONENT_STAGE = "response-redaction";
const MASK_VALUE = "[redacted]";
const REMOVED_VALUE = "[removed]";
const TRANSFORM_REMOVE_RULE_ID = "response-redactor.remove-internalNotes";
const TRANSFORM_MASK_RULE_ID = "response-redactor.mask-secret";

function sha256Hex(input: string): string {
  const rightRotate = (value: number, amount: number): number => (value >>> amount) | (value << (32 - amount));
  const utf8: number[] = [];
  for (const char of input) {
    const codePoint = char.codePointAt(0) as number;
    if (codePoint <= 0x7f) {
      utf8.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      utf8.push(0xc0 | (codePoint >> 6));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      utf8.push(0xe0 | (codePoint >> 12));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else {
      utf8.push(0xf0 | (codePoint >> 18));
      utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    }
  }
  const words: number[] = [];

  for (let i = 0; i < utf8.length; i += 1) {
    words[i >> 2] = (words[i >> 2] ?? 0) | (utf8[i] << (24 - (i % 4) * 8));
  }

  const bitLength = utf8.length * 8;
  words[bitLength >> 5] = (words[bitLength >> 5] ?? 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const hash = [
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

  for (let i = 0; i < words.length; i += 16) {
    const schedule = new Array<number>(64);
    for (let t = 0; t < 16; t += 1) {
      schedule[t] = words[i + t] ?? 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rightRotate(schedule[t - 15], 7) ^ rightRotate(schedule[t - 15], 18) ^ (schedule[t - 15] >>> 3);
      const s1 = rightRotate(schedule[t - 2], 17) ^ rightRotate(schedule[t - 2], 19) ^ (schedule[t - 2] >>> 10);
      schedule[t] = (schedule[t - 16] + s0 + schedule[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let t = 0; t < 64; t += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[t] + schedule[t]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPayload(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  if (isRecord(value)) {
    return { ...value };
  }

  return { raw: value };
}

function toPreview(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasSensitiveKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasSensitiveKeys(item)) {
        return true;
      }
    }
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "ssn" || key === "creditCard" || key === "apiKey") {
      return true;
    }
    if (hasSensitiveKeys(nested)) {
      return true;
    }
  }

  return false;
}

function sortEvents(events: RedactionEvent[]): RedactionEvent[] {
  return [...events].sort((a, b) => {
    if (a.locationPath === b.locationPath) {
      return a.ruleId.localeCompare(b.ruleId);
    }
    return a.locationPath.localeCompare(b.locationPath);
  });
}

function deriveDecisionId(upstreamDecisionId: string, status: DecisionStatus, redactionEventCount: number): string {
  return sha256Hex(`${upstreamDecisionId}${COMPONENT_STAGE}${status}${redactionEventCount}`);
}

export function redactResponse(
  policyEvaluation: PolicyEvaluationV1,
  upstreamExecutionResult: UpstreamExecutionResultV1
): RedactedResponseV1 {
  const fallbackStatus = upstreamExecutionResult.status;
  const fallbackDecisionId = deriveDecisionId(upstreamExecutionResult.decisionId, fallbackStatus, 0);

  try {
    const resultPayload = upstreamExecutionResult.upstreamResponse.result;
    const errorPayload = upstreamExecutionResult.upstreamResponse.error;
    const hasResultPayload = resultPayload !== undefined;
    const hasErrorPayload = errorPayload !== undefined;

    let responsePayload = hasResultPayload ? toPayload(resultPayload) : hasErrorPayload ? toPayload(errorPayload) : {};

    if (upstreamExecutionResult.status === "deny" && !hasResultPayload && !hasErrorPayload) {
      responsePayload = {};
    }

    const redactionEvents: RedactionEvent[] = [];

    if (policyEvaluation.status === "transform") {
      if (Object.prototype.hasOwnProperty.call(responsePayload, "internalNotes")) {
        const original = responsePayload.internalNotes;
        delete responsePayload.internalNotes;
        redactionEvents.push({
          ruleId: TRANSFORM_REMOVE_RULE_ID,
          locationPath: "$.internalNotes",
          mode: "drop",
          originalPreview: toPreview(original),
          replacementPreview: REMOVED_VALUE
        });
      }

      if (Object.prototype.hasOwnProperty.call(responsePayload, "secret")) {
        const original = responsePayload.secret;
        responsePayload.secret = MASK_VALUE;
        redactionEvents.push({
          ruleId: TRANSFORM_MASK_RULE_ID,
          locationPath: "$.secret",
          mode: "mask",
          originalPreview: toPreview(original),
          replacementPreview: MASK_VALUE
        });
      }
    }

    const sortedEvents = sortEvents(redactionEvents);
    const status: DecisionStatus = sortedEvents.length > 0 ? "transform" : upstreamExecutionResult.status;

    return {
      decisionId: deriveDecisionId(upstreamExecutionResult.decisionId, status, sortedEvents.length),
      status,
      responsePayload,
      redactionEvents: sortedEvents,
      containsSensitiveData: hasSensitiveKeys(responsePayload)
    };
  } catch {
    return {
      decisionId: fallbackDecisionId,
      status: fallbackStatus,
      responsePayload: {},
      redactionEvents: [],
      containsSensitiveData: false
    };
  }
}
