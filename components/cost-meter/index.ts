import type {
  CostLineItemV1,
  CostMeteringRecordV1,
  NormalizedProxyContextV1,
  RedactedResponseV1,
  UpstreamExecutionResultV1
} from "../artifacts";

export function costMeter(input: {
  normalizedContext: NormalizedProxyContextV1;
  upstreamExecution: UpstreamExecutionResultV1;
  redactedResponse: RedactedResponseV1;
}): CostMeteringRecordV1 {
  try {
    const invocationId = input.normalizedContext.invocationId;
    const pricing = input.normalizedContext.pricing;

    const inputTokens = toNonNegativeInteger(input.normalizedContext.requestTokenEstimate);
    const estimatedOutputTokens = toNonNegativeInteger(input.normalizedContext.responseTokenEstimate);
    const outputTokens = input.upstreamExecution.status === "deny" ? 0 : estimatedOutputTokens;

    const lineItems: CostLineItemV1[] = [
      buildLineItem("base-request", invocationId, 1, pricing.requestBaseFeeUsd),
      buildLineItem("input-tokens", invocationId, inputTokens, pricing.inputTokenPriceUsd),
      buildLineItem("output-tokens", invocationId, outputTokens, pricing.outputTokenPriceUsd)
    ].sort(compareLineItems);

    const subtotalSum = lineItems.reduce((sum, item) => sum + item.subtotalUsd, 0);
    const totalUsd = roundHalfEven(subtotalSum, 4);

    const usage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };

    const costRecordId = sha256Hex(
      `${invocationId}${canonicalJson(lineItems)}${totalUsd.toFixed(4)}`
    );

    return {
      costRecordId,
      invocationId,
      lineItems,
      totalUsd,
      usage
    };
  } catch {
    // Never throw: produce a deterministic zeroed fallback record.
    const lineItems: CostLineItemV1[] = [
      {
        category: "base-request",
        dimensionKey: "",
        quantity: 0,
        unitPriceUsd: 0,
        subtotalUsd: 0
      },
      {
        category: "input-tokens",
        dimensionKey: "",
        quantity: 0,
        unitPriceUsd: 0,
        subtotalUsd: 0
      },
      {
        category: "output-tokens",
        dimensionKey: "",
        quantity: 0,
        unitPriceUsd: 0,
        subtotalUsd: 0
      }
    ];

    const totalUsd = 0;
    const invocationId = "";

    return {
      costRecordId: sha256Hex(`${invocationId}${canonicalJson(lineItems)}${totalUsd.toFixed(4)}`),
      invocationId,
      lineItems,
      totalUsd,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    };
  }
}

function buildLineItem(
  category: CostLineItemV1["category"],
  dimensionKey: string,
  quantity: number,
  unitPriceUsd: number
): CostLineItemV1 {
  const safeQuantity = toNonNegativeInteger(quantity);
  const safeUnitPrice = toFiniteNumberOrZero(unitPriceUsd);

  return {
    category,
    dimensionKey,
    quantity: safeQuantity,
    unitPriceUsd: safeUnitPrice,
    subtotalUsd: safeQuantity * safeUnitPrice
  };
}

function toNonNegativeInteger(value: number): number {
  const safe = toFiniteNumberOrZero(value);
  if (safe <= 0) {
    return 0;
  }

  return Math.floor(safe);
}

function toFiniteNumberOrZero(value: number): number {
  if (!isFinite(value)) {
    return 0;
  }

  return value;
}

function compareLineItems(a: CostLineItemV1, b: CostLineItemV1): number {
  if (a.category < b.category) {
    return -1;
  }
  if (a.category > b.category) {
    return 1;
  }
  if (a.dimensionKey < b.dimensionKey) {
    return -1;
  }
  if (a.dimensionKey > b.dimensionKey) {
    return 1;
  }

  return 0;
}

function roundHalfEven(value: number, scale: number): number {
  const factor = Math.pow(10, scale);
  const normalized = value * factor;

  if (!isFinite(normalized)) {
    return 0;
  }

  const floorValue = Math.floor(normalized);
  const diff = normalized - floorValue;
  const epsilon = 1e-12 * Math.max(1, Math.abs(normalized));

  let rounded: number;
  if (diff > 0.5 + epsilon) {
    rounded = floorValue + 1;
  } else if (diff < 0.5 - epsilon) {
    rounded = floorValue;
  } else {
    rounded = floorValue % 2 === 0 ? floorValue : floorValue + 1;
  }

  return rounded / factor;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const input = value as Record<string, unknown>;
  const sortedKeys = Object.keys(input).sort();
  const output: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    output[key] = canonicalize(input[key]);
  }

  return output;
}

function sha256Hex(input: string): string {
  const bytes = utf8Encode(input);
  const digest = sha256(bytes);
  return toHex(digest);
}

function utf8Encode(input: string): number[] {
  const bytes: number[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const codePoint = input.charCodeAt(i);

    if (codePoint < 0x80) {
      bytes.push(codePoint);
      continue;
    }
    if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
      continue;
    }

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const pair = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        bytes.push(0xf0 | (pair >> 18));
        bytes.push(0x80 | ((pair >> 12) & 0x3f));
        bytes.push(0x80 | ((pair >> 6) & 0x3f));
        bytes.push(0x80 | (pair & 0x3f));
        i += 1;
        continue;
      }
    }

    bytes.push(0xe0 | (codePoint >> 12));
    bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
    bytes.push(0x80 | (codePoint & 0x3f));
  }

  return bytes;
}

function sha256(message: number[]): number[] {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const padded = message.slice();
  const bitLength = padded.length * 8;
  padded.push(0x80);
  while ((padded.length % 64) !== 56) {
    padded.push(0);
  }
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  padded.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  for (let offset = 0; offset < padded.length; offset += 64) {
    const W: number[] = new Array(64);
    for (let t = 0; t < 16; t += 1) {
      const i = offset + (t * 4);
      W[t] = ((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = (rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10)) >>> 0;
      W[t] = (((W[t - 16] + s0) >>> 0) + ((W[t - 7] + s1) >>> 0)) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let t = 0; t < 64; t += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (((((h + s1) >>> 0) + ch) >>> 0) + ((K[t] + W[t]) >>> 0)) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const output: number[] = [];
  for (let i = 0; i < H.length; i += 1) {
    output.push((H[i] >>> 24) & 0xff, (H[i] >>> 16) & 0xff, (H[i] >>> 8) & 0xff, H[i] & 0xff);
  }
  return output;
}

function rotr(value: number, amount: number): number {
  return ((value >>> amount) | (value << (32 - amount))) >>> 0;
}

function toHex(bytes: number[]): string {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[(bytes[i] >> 4) & 0xf];
    out += alphabet[bytes[i] & 0xf];
  }
  return out;
}
