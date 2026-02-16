import type {
  AuthEvaluationV1,
  CostMeteringRecordV1,
  MiddlewareDecisionLog,
  MiddlewareExecutionReportV1,
  NormalizedProxyContextV1,
  PolicyEvaluationV1,
  RateLimitDecisionV1,
  RedactedRequestV1,
  RedactedResponseV1,
  ToolFilterDecisionV1,
  TraceRecordSetV1,
  UpstreamExecutionResultV1
} from "../artifacts";

type ExchangeAssemblerInput = {
  normalizedContext: NormalizedProxyContextV1;
  authEvaluation: AuthEvaluationV1;
  policyEvaluation: PolicyEvaluationV1;
  toolFilterDecision: ToolFilterDecisionV1;
  rateLimitDecision: RateLimitDecisionV1;
  redactedRequest: RedactedRequestV1;
  upstreamExecutionResult: UpstreamExecutionResultV1;
  redactedResponse: RedactedResponseV1;
  traceRecordSet: TraceRecordSetV1;
  costMeteringRecord: CostMeteringRecordV1;
};

function toReasonCode(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Hex(input: string): string {
  const primes = [
    1116352408, 1899447441, 3049323471, 3921009573,
    961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987,
    1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628,
    770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671,
    3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291,
    1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771,
    3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877,
    958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424,
    2428436474, 2756734187, 3204031479, 3329325298
  ];

  const hash = [
    1779033703, 3144134277, 1013904242, 2773480762,
    1359893119, 2600822924, 528734635, 1541459225
  ];

  const bytes: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);

  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }

  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push((bitLength / (2 ** shift)) & 0xff);
  }

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Array<number>(64).fill(0);

    for (let wordIndex = 0; wordIndex < 16; wordIndex += 1) {
      const i = offset + wordIndex * 4;
      words[wordIndex] = (
        (bytes[i] << 24)
        | (bytes[i + 1] << 16)
        | (bytes[i + 2] << 8)
        | bytes[i + 3]
      ) >>> 0;
    }

    for (let wordIndex = 16; wordIndex < 64; wordIndex += 1) {
      const s0 = (
        rightRotate(words[wordIndex - 15], 7)
        ^ rightRotate(words[wordIndex - 15], 18)
        ^ (words[wordIndex - 15] >>> 3)
      ) >>> 0;
      const s1 = (
        rightRotate(words[wordIndex - 2], 17)
        ^ rightRotate(words[wordIndex - 2], 19)
        ^ (words[wordIndex - 2] >>> 10)
      ) >>> 0;
      words[wordIndex] = (words[wordIndex - 16] + s0 + words[wordIndex - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let wordIndex = 0; wordIndex < 64; wordIndex += 1) {
      const s1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + choose + primes[wordIndex] + words[wordIndex]) >>> 0;
      const s0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
}

function deriveExecutionReportId(
  invocationId: string,
  policyDecisionId: string,
  rateLimitDecisionId: string,
  costRecordId: string
): string {
  return sha256Hex(invocationId + policyDecisionId + rateLimitDecisionId + costRecordId);
}

function buildMiddlewareDecisions(input: ExchangeAssemblerInput): MiddlewareDecisionLog[] {
  const policyReason = input.policyEvaluation.deniedReasonCode
    ?? input.policyEvaluation.applicableRules[0]?.reasonCode;

  const toolReason = input.toolFilterDecision.selectedToolAllowed
    ? "tool-filter:allowed"
    : input.toolFilterDecision.blockedTools[0]?.reasonCode;

  const rateReason = input.rateLimitDecision.deniedReasonCode
    ?? (input.rateLimitDecision.allowed ? "rate-limit:allowed" : "rate-limit:denied");

  const requestRedactionReason = input.redactedRequest.redactionEvents.length > 0
    ? `request-redaction:${input.redactedRequest.redactionEvents[0].ruleId}`
    : "request-redaction:none";

  const dispatchReason = input.upstreamExecutionResult.dispatched
    ? "dispatch:dispatched"
    : input.upstreamExecutionResult.blockedByStage
      ? `dispatch:blocked-by-${input.upstreamExecutionResult.blockedByStage}`
      : "dispatch:not-dispatched";

  const responseReason = input.redactedResponse.redactionEvents.length > 0
    ? `response-redaction:${input.redactedResponse.redactionEvents[0].ruleId}`
    : "response-redaction:none";

  const decisions: MiddlewareDecisionLog[] = [
    {
      componentId: "auth-evaluator",
      stage: "authenticate",
      status: input.authEvaluation.status,
      reasonCode: toReasonCode(input.authEvaluation.reasonCode, "auth:unspecified"),
      decisionId: input.authEvaluation.decisionId
    },
    {
      componentId: "policy-evaluator",
      stage: "policy",
      status: input.policyEvaluation.status,
      reasonCode: toReasonCode(policyReason, "policy:unspecified"),
      decisionId: input.policyEvaluation.decisionId
    },
    {
      componentId: "tool-visibility-filter",
      stage: "tool-filter",
      status: input.toolFilterDecision.status,
      reasonCode: toReasonCode(toolReason, "tool-filter:unspecified"),
      decisionId: input.toolFilterDecision.decisionId
    },
    {
      componentId: "rate-limit-enforcer",
      stage: "rate-limit",
      status: input.rateLimitDecision.status,
      reasonCode: toReasonCode(rateReason, "rate-limit:unspecified"),
      decisionId: input.rateLimitDecision.decisionId
    },
    {
      componentId: "request-redactor",
      stage: "request-redaction",
      status: input.redactedRequest.status,
      reasonCode: toReasonCode(requestRedactionReason, "request-redaction:unspecified"),
      decisionId: input.redactedRequest.decisionId
    },
    {
      componentId: "upstream-dispatcher",
      stage: "dispatch",
      status: input.upstreamExecutionResult.status,
      reasonCode: toReasonCode(dispatchReason, "dispatch:unspecified"),
      decisionId: input.upstreamExecutionResult.decisionId
    },
    {
      componentId: "response-redactor",
      stage: "response-redaction",
      status: input.redactedResponse.status,
      reasonCode: toReasonCode(responseReason, "response-redaction:unspecified"),
      decisionId: input.redactedResponse.decisionId
    },
    {
      componentId: "trace-recorder",
      stage: "trace",
      status: "observe-only",
      reasonCode: toReasonCode(input.traceRecordSet.exportTarget, "trace:unspecified"),
      decisionId: input.traceRecordSet.traceId
    },
    {
      componentId: "cost-meter",
      stage: "cost-meter",
      status: "observe-only",
      reasonCode: "cost:computed",
      decisionId: input.costMeteringRecord.costRecordId
    }
  ];

  decisions.sort((a, b) => {
    const stageOrder = a.stage.localeCompare(b.stage);
    if (stageOrder !== 0) {
      return stageOrder;
    }

    return a.status.localeCompare(b.status);
  });

  return decisions;
}

function deriveFinalStatus(
  middlewareDecisions: MiddlewareDecisionLog[],
  upstreamExecutionResult: UpstreamExecutionResultV1
): MiddlewareExecutionReportV1["finalStatus"] {
  const gatingStages = new Set([
    "authenticate",
    "policy",
    "tool-filter",
    "rate-limit",
    "request-redaction",
    "dispatch"
  ]);

  const hasGatingDeny = middlewareDecisions.some(
    (decision) => gatingStages.has(decision.stage) && decision.status === "deny"
  );

  if (hasGatingDeny) {
    return "blocked";
  }

  if (upstreamExecutionResult.status === "deny" && upstreamExecutionResult.httpStatusCode >= 500) {
    return "errored";
  }

  return "served";
}

export function assembleExchange(
  input: ExchangeAssemblerInput
): MiddlewareExecutionReportV1 {
  try {
    const middlewareDecisions = buildMiddlewareDecisions(input);

    const executionReportId = deriveExecutionReportId(
      input.normalizedContext.invocationId,
      input.policyEvaluation.decisionId,
      input.rateLimitDecision.decisionId,
      input.costMeteringRecord.costRecordId
    );

    return {
      executionReportId,
      invocationId: input.normalizedContext.invocationId,
      traceId: input.normalizedContext.traceId,
      finalStatus: deriveFinalStatus(middlewareDecisions, input.upstreamExecutionResult),
      middlewareDecisions,
      requestSummary: {
        tenantId: input.normalizedContext.tenantId,
        userId: input.normalizedContext.userId,
        agentId: input.normalizedContext.agentId,
        serverId: input.redactedRequest.serverId,
        toolName: input.redactedRequest.toolName || input.normalizedContext.normalizedToolName
      },
      enforcementSummary: {
        authPassed: input.authEvaluation.authenticated,
        policyStatus: input.policyEvaluation.status,
        rateLimitAllowed: input.rateLimitDecision.allowed,
        selectedToolAllowed: input.toolFilterDecision.selectedToolAllowed
      },
      observability: {
        spanCount: input.traceRecordSet.spans.length,
        metricCount: input.traceRecordSet.metrics.length
      },
      cost: {
        totalUsd: input.costMeteringRecord.totalUsd,
        totalTokens: input.costMeteringRecord.usage.totalTokens
      },
      response: {
        httpStatusCode: input.upstreamExecutionResult.httpStatusCode,
        dispatched: input.upstreamExecutionResult.dispatched,
        containsSensitiveData: input.redactedResponse.containsSensitiveData
      }
    };
  } catch {
    return {
      executionReportId: "3cf96bb647d58b00c60a742ea6d044fb07f3d5802464777b43bedc1417f73848",
      invocationId: "",
      traceId: "",
      finalStatus: "errored",
      middlewareDecisions: [
        {
          componentId: "auth-evaluator",
          stage: "authenticate",
          status: "deny",
          reasonCode: "auth:unspecified",
          decisionId: ""
        },
        {
          componentId: "cost-meter",
          stage: "cost-meter",
          status: "observe-only",
          reasonCode: "cost:computed",
          decisionId: ""
        },
        {
          componentId: "upstream-dispatcher",
          stage: "dispatch",
          status: "deny",
          reasonCode: "dispatch:unspecified",
          decisionId: ""
        },
        {
          componentId: "policy-evaluator",
          stage: "policy",
          status: "deny",
          reasonCode: "policy:unspecified",
          decisionId: ""
        },
        {
          componentId: "rate-limit-enforcer",
          stage: "rate-limit",
          status: "deny",
          reasonCode: "rate-limit:unspecified",
          decisionId: ""
        },
        {
          componentId: "request-redactor",
          stage: "request-redaction",
          status: "deny",
          reasonCode: "request-redaction:unspecified",
          decisionId: ""
        },
        {
          componentId: "response-redactor",
          stage: "response-redaction",
          status: "observe-only",
          reasonCode: "response-redaction:unspecified",
          decisionId: ""
        },
        {
          componentId: "tool-visibility-filter",
          stage: "tool-filter",
          status: "deny",
          reasonCode: "tool-filter:unspecified",
          decisionId: ""
        },
        {
          componentId: "trace-recorder",
          stage: "trace",
          status: "observe-only",
          reasonCode: "trace:unspecified",
          decisionId: ""
        }
      ],
      requestSummary: {
        tenantId: "",
        userId: "",
        agentId: "",
        serverId: "",
        toolName: ""
      },
      enforcementSummary: {
        authPassed: false,
        policyStatus: "deny",
        rateLimitAllowed: false,
        selectedToolAllowed: false
      },
      observability: {
        spanCount: 0,
        metricCount: 0
      },
      cost: {
        totalUsd: 0,
        totalTokens: 0
      },
      response: {
        httpStatusCode: 500,
        dispatched: false,
        containsSensitiveData: false
      }
    };
  }
}
