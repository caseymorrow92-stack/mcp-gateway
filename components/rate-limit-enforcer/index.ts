import type {
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RateLimitAppliedRule,
  RateLimitDecisionV1,
  RateLimitRule
} from "../artifacts";

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function hashSha256(input: string): string {
  let utf8Input = unescape(encodeURIComponent(input));
  const maxWord = Math.pow(2, 32);
  const words: number[] = [];
  const hash: number[] = [];
  const k: number[] = [];
  const isComposite: Record<number, boolean> = {};
  let primeCounter = 0;

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let multiple = 0; multiple < 313; multiple += candidate) {
        isComposite[multiple] = true;
      }
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  utf8Input += "\x80";
  while ((utf8Input.length % 64) - 56) {
    utf8Input += "\x00";
  }

  for (let i = 0; i < utf8Input.length; i += 1) {
    const j = utf8Input.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = ((utf8Input.length * 8) / maxWord) | 0;
  words[words.length] = (utf8Input.length * 8) | 0;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    hash.length = 8;

    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        (hash[7] +
          rightRotate(e, 6) +
          rightRotate(e, 11) +
          rightRotate(e, 25) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0)) |
        0;
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  let output = "";
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j >= 0; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      output += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return output;
}

function buildDecisionId(invocationId: string, status: RateLimitDecisionV1["status"], deniedReasonCode?: string): string {
  return hashSha256(invocationId + "rate-limit" + status + (deniedReasonCode || "none"));
}

function buildRuleKey(context: NormalizedProxyContextV1, rule: RateLimitRule): string {
  if (rule.dimension === "user") {
    return context.tenantId + ":" + context.userId;
  }
  if (rule.dimension === "agent") {
    return context.tenantId + ":" + context.agentId;
  }
  return context.tenantId + ":" + context.normalizedToolName;
}

function stableRuleSort(a: RateLimitAppliedRule, b: RateLimitAppliedRule): number {
  if (a.dimension < b.dimension) {
    return -1;
  }
  if (a.dimension > b.dimension) {
    return 1;
  }
  if (a.windowSeconds !== b.windowSeconds) {
    return a.windowSeconds - b.windowSeconds;
  }
  if (a.limit !== b.limit) {
    return a.limit - b.limit;
  }
  if (a.ruleId < b.ruleId) {
    return -1;
  }
  if (a.ruleId > b.ruleId) {
    return 1;
  }
  return 0;
}

function safeObservedCount(context: NormalizedProxyContextV1, key: string): number {
  const value = context.historicalCallsInWindow[key];
  return typeof value === "number" && isFinite(value) ? value : 0;
}

function computeRetryAfterSeconds(context: NormalizedProxyContextV1, windowSeconds: number): number {
  const maybeReceivedAt = (context as NormalizedProxyContextV1 & { receivedAtEpochMs?: number }).receivedAtEpochMs;
  const receivedAtEpochMs = typeof maybeReceivedAt === "number" && isFinite(maybeReceivedAt)
    ? maybeReceivedAt
    : context.windowStartEpochMs;
  const elapsedSeconds = Math.floor((receivedAtEpochMs - context.windowStartEpochMs) / 1000);
  return Math.max(0, windowSeconds - elapsedSeconds);
}

export function enforceRateLimit(
  normalizedProxyContext: NormalizedProxyContextV1,
  policyEvaluation: PolicyEvaluationV1
): RateLimitDecisionV1 {
  try {
    if (policyEvaluation.status === "deny") {
      const deniedReasonCode = "policy-deny";
      return {
        decisionId: buildDecisionId(normalizedProxyContext.invocationId, "deny", deniedReasonCode),
        status: "deny",
        allowed: false,
        retryAfterSeconds: 0,
        appliedRules: [],
        deniedReasonCode
      };
    }

    const appliedRules: RateLimitAppliedRule[] = normalizedProxyContext.rateLimitRules.map((rule) => {
      const key = buildRuleKey(normalizedProxyContext, rule);
      return {
        ruleId: rule.ruleId,
        dimension: rule.dimension,
        key,
        windowSeconds: rule.windowSeconds,
        limit: rule.limit,
        observedCount: safeObservedCount(normalizedProxyContext, key)
      };
    });

    appliedRules.sort(stableRuleSort);

    const failedRules = appliedRules.filter((rule) => rule.observedCount >= rule.limit);
    if (failedRules.length > 0) {
      const deniedReasonCode = "rate-limit-exceeded";
      const retryAfterSeconds = failedRules.reduce((maxRetry, rule) => {
        const retry = computeRetryAfterSeconds(normalizedProxyContext, rule.windowSeconds);
        return retry > maxRetry ? retry : maxRetry;
      }, 0);

      return {
        decisionId: buildDecisionId(normalizedProxyContext.invocationId, "deny", deniedReasonCode),
        status: "deny",
        allowed: false,
        retryAfterSeconds,
        appliedRules,
        deniedReasonCode
      };
    }

    return {
      decisionId: buildDecisionId(normalizedProxyContext.invocationId, "allow"),
      status: "allow",
      allowed: true,
      retryAfterSeconds: 0,
      appliedRules
    };
  } catch {
    const deniedReasonCode = "rate-limit-enforcer-error";
    return {
      decisionId: buildDecisionId(normalizedProxyContext.invocationId, "deny", deniedReasonCode),
      status: "deny",
      allowed: false,
      retryAfterSeconds: 0,
      appliedRules: [],
      deniedReasonCode
    };
  }
}
