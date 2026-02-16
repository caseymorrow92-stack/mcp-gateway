import type {
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RedactedRequestV1,
  RedactionEvent,
  RedactionRule,
  ToolFilterDecisionV1
} from "../artifacts";

export type RequestRedactorInput = {
  normalizedContext: NormalizedProxyContextV1;
  policyEvaluation: PolicyEvaluationV1;
  toolFilterDecision: ToolFilterDecisionV1;
};

type MutableContainer = Record<string, unknown> | unknown[];

const REDACTION_STAGE = "request-redaction";
const HEX_CHARS = "0123456789abcdef";
const SHA256_K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
const SHA256_H0: number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

export function redactRequest(input: RequestRedactorInput): RedactedRequestV1 {
  try {
    const { normalizedContext, policyEvaluation, toolFilterDecision } = input;
    const toolName = normalizedContext.normalizedToolName;
    const serverId = resolveServerId(normalizedContext);

    if (policyEvaluation.status === "deny" || !toolFilterDecision.selectedToolAllowed) {
      const status = "deny" as const;
      return {
        decisionId: sha256Hex(normalizedContext.invocationId + REDACTION_STAGE + status + "0"),
        status,
        serverId,
        toolName,
        arguments: normalizedContext.requestPayload,
        redactionEvents: []
      };
    }

    const mutablePayload = deepClone(normalizedContext.requestPayload);
    const redactionEvents: RedactionEvent[] = [];
    const orderedRules = normalizedContext.redactionRules.slice().sort(compareRules);

    for (let i = 0; i < orderedRules.length; i += 1) {
      applyRule(mutablePayload, orderedRules[i], redactionEvents);
    }

    redactionEvents.sort(compareEvents);

    const status = redactionEvents.length > 0 ? "transform" : "allow";

    return {
      decisionId: sha256Hex(
        normalizedContext.invocationId + REDACTION_STAGE + status + String(redactionEvents.length)
      ),
      status,
      serverId,
      toolName,
      arguments: mutablePayload,
      redactionEvents
    };
  } catch {
    const invocationId = input && input.normalizedContext ? input.normalizedContext.invocationId : "";
    const toolName = input && input.normalizedContext ? input.normalizedContext.normalizedToolName : "";
    const serverId = input && input.normalizedContext ? resolveServerId(input.normalizedContext) : "";
    const fallbackArgs =
      input && input.normalizedContext && isObjectRecord(input.normalizedContext.requestPayload)
        ? input.normalizedContext.requestPayload
        : {};

    return {
      decisionId: sha256Hex(invocationId + REDACTION_STAGE + "deny0"),
      status: "deny",
      serverId,
      toolName,
      arguments: fallbackArgs,
      redactionEvents: []
    };
  }
}

function resolveServerId(normalizedContext: NormalizedProxyContextV1): string {
  const payloadServerId = normalizedContext.requestPayload.serverId;
  if (typeof payloadServerId === "string") {
    return payloadServerId;
  }

  const candidates = normalizedContext.toolCatalog
    .filter((entry) => entry.toolName === normalizedContext.normalizedToolName)
    .map((entry) => entry.serverId)
    .sort(compareText);

  return candidates.length > 0 ? candidates[0] : "";
}

function applyRule(
  payload: Record<string, unknown>,
  rule: RedactionRule,
  redactionEvents: RedactionEvent[]
): void {
  const resolved = resolvePath(payload, rule.matchPath);
  if (!resolved) {
    return;
  }

  const { parent, key, value, locationPath } = resolved;

  if (rule.mode === "mask") {
    setContainerValue(parent, key, rule.replacement);
    redactionEvents.push({
      ruleId: rule.ruleId,
      locationPath,
      mode: rule.mode,
      originalPreview: preview(value),
      replacementPreview: preview(rule.replacement)
    });
    return;
  }

  if (rule.mode === "drop") {
    deleteContainerValue(parent, key);
    redactionEvents.push({
      ruleId: rule.ruleId,
      locationPath,
      mode: rule.mode,
      originalPreview: preview(value),
      replacementPreview: "[dropped]"
    });
    return;
  }

  if (typeof value !== "string") {
    return;
  }

  const replacement = sha256Hex(value);
  setContainerValue(parent, key, replacement);
  redactionEvents.push({
    ruleId: rule.ruleId,
    locationPath,
    mode: rule.mode,
    originalPreview: preview(value),
    replacementPreview: preview(replacement)
  });
}

function resolvePath(
  payload: Record<string, unknown>,
  matchPath: string
): { parent: MutableContainer; key: string; value: unknown; locationPath: string } | null {
  if (matchPath.length === 0) {
    return null;
  }

  const segments = matchPath.split(".");
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].length === 0) {
      return null;
    }
  }

  let current: unknown = payload;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];

    if (!isObjectLike(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return null;
    }

    current = getContainerValue(current as MutableContainer, segment);
  }

  const key = segments[segments.length - 1];

  if (!isObjectLike(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
    return null;
  }

  const parent = current as MutableContainer;
  return {
    parent,
    key,
    value: getContainerValue(parent, key),
    locationPath: matchPath
  };
}

function deepClone(value: Record<string, unknown>): Record<string, unknown> {
  const seenFrom: object[] = [];
  const seenTo: object[] = [];
  return cloneRecord(value, seenFrom, seenTo);
}

function cloneUnknown(value: unknown, seenFrom: object[], seenTo: object[]): unknown {
  if (!isObjectLike(value)) {
    return value;
  }

  const seenIndex = seenFrom.indexOf(value);
  if (seenIndex >= 0) {
    return seenTo[seenIndex];
  }

  if (Array.isArray(value)) {
    const clonedArray: unknown[] = [];
    seenFrom.push(value);
    seenTo.push(clonedArray);
    for (let i = 0; i < value.length; i += 1) {
      clonedArray.push(cloneUnknown(value[i], seenFrom, seenTo));
    }
    return clonedArray;
  }

  const clonedObject: Record<string, unknown> = {};
  seenFrom.push(value);
  seenTo.push(clonedObject);

  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    clonedObject[key] = cloneUnknown((value as Record<string, unknown>)[key], seenFrom, seenTo);
  }

  return clonedObject;
}

function cloneRecord(value: Record<string, unknown>, seenFrom: object[], seenTo: object[]): Record<string, unknown> {
  const cloned = cloneUnknown(value, seenFrom, seenTo);
  if (isObjectRecord(cloned)) {
    return cloned;
  }
  return {};
}

function preview(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }
  return "[object]";
}

function compareRules(left: RedactionRule, right: RedactionRule): number {
  const byRuleId = compareText(left.ruleId, right.ruleId);
  if (byRuleId !== 0) {
    return byRuleId;
  }
  return compareText(left.matchPath, right.matchPath);
}

function compareEvents(left: RedactionEvent, right: RedactionEvent): number {
  const byPath = compareText(left.locationPath, right.locationPath);
  if (byPath !== 0) {
    return byPath;
  }
  return compareText(left.ruleId, right.ruleId);
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sha256Hex(value: string): string {
  const bytes = utf8Encode(value);
  const bitLengthHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLengthLo = (bytes.length * 8) >>> 0;

  const padded = bytes.slice();
  padded.push(0x80);
  while ((padded.length % 64) !== 56) {
    padded.push(0);
  }

  padded.push((bitLengthHi >>> 24) & 0xff);
  padded.push((bitLengthHi >>> 16) & 0xff);
  padded.push((bitLengthHi >>> 8) & 0xff);
  padded.push(bitLengthHi & 0xff);
  padded.push((bitLengthLo >>> 24) & 0xff);
  padded.push((bitLengthLo >>> 16) & 0xff);
  padded.push((bitLengthLo >>> 8) & 0xff);
  padded.push(bitLengthLo & 0xff);

  const h = SHA256_H0.slice();
  const w: number[] = [];
  for (let i = 0; i < 64; i += 1) {
    w.push(0);
  }

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const index = offset + i * 4;
      w[i] =
        ((padded[index] << 24) | (padded[index + 1] << 16) | (padded[index + 2] << 8) | padded[index + 3]) >>> 0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
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

  let output = "";
  for (let i = 0; i < h.length; i += 1) {
    output += hexWord(h[i]);
  }
  return output;
}

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return isObjectLike(value) && !Array.isArray(value);
}

function isArrayIndexKey(key: string): boolean {
  if (!/^\d+$/.test(key)) {
    return false;
  }

  const index = Number(key);
  return index >= 0 && Math.floor(index) === index && index <= 9007199254740991;
}

function getContainerValue(container: MutableContainer, key: string): unknown {
  return (container as Record<string, unknown>)[key];
}

function setContainerValue(container: MutableContainer, key: string, value: unknown): void {
  (container as Record<string, unknown>)[key] = value;
}

function deleteContainerValue(container: MutableContainer, key: string): void {
  if (Array.isArray(container) && isArrayIndexKey(key)) {
    container.splice(Number(key), 1);
    return;
  }

  delete (container as Record<string, unknown>)[key];
}

function rightRotate(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8Encode(value: string): number[] {
  const output: number[] = [];

  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);

    if (code < 0x80) {
      output.push(code);
      continue;
    }

    if (code < 0x800) {
      output.push(0xc0 | (code >>> 6));
      output.push(0x80 | (code & 0x3f));
      continue;
    }

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
        i += 1;
        output.push(0xf0 | (code >>> 18));
        output.push(0x80 | ((code >>> 12) & 0x3f));
        output.push(0x80 | ((code >>> 6) & 0x3f));
        output.push(0x80 | (code & 0x3f));
        continue;
      }
    }

    output.push(0xe0 | (code >>> 12));
    output.push(0x80 | ((code >>> 6) & 0x3f));
    output.push(0x80 | (code & 0x3f));
  }

  return output;
}

function hexWord(value: number): string {
  let output = "";
  for (let shift = 28; shift >= 0; shift -= 4) {
    output += HEX_CHARS[(value >>> shift) & 0x0f];
  }
  return output;
}
