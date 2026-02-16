/**
 * Shared artifacts for MCP Middleware Platform.
 *
 * The pipeline ingests a raw MCP invocation, applies deterministic middleware
 * decisions, and emits a complete execution report.
 */

export type DecisionStatus = "allow" | "deny" | "transform" | "observe-only";

export type RedactionMode = "mask" | "drop" | "hash";

export type RateLimitDimension = "user" | "agent" | "tool";

export type MiddlewareStage =
  | "normalize"
  | "authenticate"
  | "policy"
  | "tool-filter"
  | "rate-limit"
  | "request-redaction"
  | "dispatch"
  | "response-redaction"
  | "trace"
  | "cost-meter";

export type MCPTransport = "stdio" | "http" | "ws";

export type MCPToolCall = {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
};

export type MCPEnvelope = {
  protocolVersion: string;
  requestId: string;
  method: string;
  transport: MCPTransport;
  receivedAtEpochMs: number;
  toolCall: MCPToolCall;
};

export type InvocationContext = {
  tenantId: string;
  environment: "dev" | "staging" | "prod";
  sessionId: string;
  userId: string;
  agentId: string;
  orgRoles: string[];
  scopes: string[];
  sourceIp: string;
};

export type PolicyRuleSnapshot = {
  ruleId: string;
  stage: MiddlewareStage;
  status: DecisionStatus;
  conditionDsl: string;
  reasonCode: string;
  priority: number;
};

export type RateLimitRule = {
  ruleId: string;
  dimension: RateLimitDimension;
  windowSeconds: number;
  limit: number;
  keyTemplate: string;
};

export type ToolCatalogEntry = {
  serverId: string;
  toolName: string;
  description: string;
  visibility: "public" | "restricted" | "private";
  scopeRequirements: string[];
};

export type RedactionRule = {
  ruleId: string;
  mode: RedactionMode;
  matchPath: string;
  replacement: string;
};

export type CostPricingTable = {
  inputTokenPriceUsd: number;
  outputTokenPriceUsd: number;
  requestBaseFeeUsd: number;
};

export type ProxyProcessSpawnRequestV1 = {
  proxyCommand: string;
  transport: "stdio";
  serverProfileId: string;
  tenantId: string;
  allowedCommandPrefixes: string[];
  maxRestarts: number;
  restartBackoffMs: number;
  killTimeoutMs: number;
};

export type ProxyProcessSpawnDecisionV1 = {
  decisionId: string;
  status: DecisionStatus;
  reasonCode: string;
  normalizedCommand: string;
  spawn: {
    allowed: boolean;
    argv: string[];
    maxRestarts: number;
    restartBackoffMs: number;
    killTimeoutMs: number;
  };
};

export type RawProxyInvocationV1 = {
  invocationIdHint?: string;
  envelope: MCPEnvelope;
  context: InvocationContext;
  policyRules: PolicyRuleSnapshot[];
  rateLimitRules: RateLimitRule[];
  toolCatalog: ToolCatalogEntry[];
  redactionRules: RedactionRule[];
  pricing: CostPricingTable;
  usageSnapshot: {
    tokenEstimateInput: number;
    tokenEstimateOutput: number;
    historicalCallsInWindow: Record<string, number>;
    windowStartEpochMs: number;
  };
};

export type NormalizedProxyContextV1 = {
  invocationId: string;
  traceId: string;
  normalizedMethod: string;
  normalizedToolName: string;
  tenantId: string;
  userId: string;
  agentId: string;
  scopes: string[];
  requestPayload: Record<string, unknown>;
  requestTokenEstimate: number;
  responseTokenEstimate: number;
  policyRules: PolicyRuleSnapshot[];
  rateLimitRules: RateLimitRule[];
  toolCatalog: ToolCatalogEntry[];
  redactionRules: RedactionRule[];
  pricing: CostPricingTable;
  historicalCallsInWindow: Record<string, number>;
  windowStartEpochMs: number;
};

export type AuthEvaluationV1 = {
  decisionId: string;
  authenticated: boolean;
  status: DecisionStatus;
  principal: {
    tenantId: string;
    userId: string;
    agentId: string;
    effectiveScopes: string[];
  };
  failedChecks: string[];
  reasonCode: string;
};

export type PolicyMatch = {
  ruleId: string;
  stage: MiddlewareStage;
  status: DecisionStatus;
  reasonCode: string;
  priority: number;
};

export type PolicyEvaluationV1 = {
  decisionId: string;
  status: DecisionStatus;
  applicableRules: PolicyMatch[];
  transformPatches: {
    path: string;
    op: "set" | "remove" | "append";
    value?: unknown;
  }[];
  deniedReasonCode?: string;
};

export type ToolVisibilityDecision = {
  serverId: string;
  toolName: string;
  reasonCode: string;
};

export type ToolFilterDecisionV1 = {
  decisionId: string;
  status: DecisionStatus;
  allowedTools: {
    serverId: string;
    toolName: string;
    summarizedDescription: string;
  }[];
  blockedTools: ToolVisibilityDecision[];
  selectedToolAllowed: boolean;
};

export type RateLimitAppliedRule = {
  ruleId: string;
  dimension: RateLimitDimension;
  key: string;
  windowSeconds: number;
  limit: number;
  observedCount: number;
};

export type RateLimitDecisionV1 = {
  decisionId: string;
  status: DecisionStatus;
  allowed: boolean;
  retryAfterSeconds: number;
  appliedRules: RateLimitAppliedRule[];
  deniedReasonCode?: string;
};

export type RedactionEvent = {
  ruleId: string;
  locationPath: string;
  mode: RedactionMode;
  originalPreview: string;
  replacementPreview: string;
};

export type RedactedRequestV1 = {
  decisionId: string;
  status: DecisionStatus;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  redactionEvents: RedactionEvent[];
};

export type UpstreamExecutionResultV1 = {
  decisionId: string;
  status: DecisionStatus;
  dispatched: boolean;
  blockedByStage?: MiddlewareStage;
  httpStatusCode: number;
  upstreamLatencyMs: number;
  upstreamResponse: {
    result?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  };
};

export type RedactedResponseV1 = {
  decisionId: string;
  status: DecisionStatus;
  responsePayload: Record<string, unknown>;
  redactionEvents: RedactionEvent[];
  containsSensitiveData: boolean;
};

export type TraceSpanV1 = {
  spanId: string;
  spanKind: "middleware" | "upstream";
  spanName: string;
  stage: MiddlewareStage;
  status: "ok" | "error";
  attributes: Record<string, string | number | boolean>;
};

export type TraceRecordSetV1 = {
  traceId: string;
  spans: TraceSpanV1[];
  metrics: {
    key: string;
    value: number;
  }[];
  exportTarget: string;
};

export type CostLineItemV1 = {
  category: "base-request" | "input-tokens" | "output-tokens";
  dimensionKey: string;
  quantity: number;
  unitPriceUsd: number;
  subtotalUsd: number;
};

export type CostMeteringRecordV1 = {
  costRecordId: string;
  invocationId: string;
  lineItems: CostLineItemV1[];
  totalUsd: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export type MiddlewareDecisionLog = {
  componentId: string;
  stage: MiddlewareStage;
  status: DecisionStatus;
  reasonCode: string;
  decisionId: string;
};

export type MiddlewareExecutionReportV1 = {
  executionReportId: string;
  invocationId: string;
  traceId: string;
  finalStatus: "served" | "blocked" | "errored";
  middlewareDecisions: MiddlewareDecisionLog[];
  requestSummary: {
    tenantId: string;
    userId: string;
    agentId: string;
    serverId: string;
    toolName: string;
  };
  enforcementSummary: {
    authPassed: boolean;
    policyStatus: DecisionStatus;
    rateLimitAllowed: boolean;
    selectedToolAllowed: boolean;
  };
  observability: {
    spanCount: number;
    metricCount: number;
  };
  cost: {
    totalUsd: number;
    totalTokens: number;
  };
  response: {
    httpStatusCode: number;
    dispatched: boolean;
    containsSensitiveData: boolean;
  };
};
