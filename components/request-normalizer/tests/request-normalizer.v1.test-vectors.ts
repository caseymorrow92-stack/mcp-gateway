import type { RawProxyInvocationV1 } from "../../artifacts";
import { normalizeRequest } from "../index";

type RequestNormalizerVector = {
  name: string;
  input: Parameters<typeof normalizeRequest>[0];
  expected: ReturnType<typeof normalizeRequest>;
};

const HAPPY_PATH_WITH_HINT_INPUT: RawProxyInvocationV1 = {
  invocationIdHint: "hint-123",
  envelope: {
    protocolVersion: "2025-01-01",
    requestId: "REQ-9",
    method: "TOOLS/CALL",
    transport: "http",
    receivedAtEpochMs: 1700000000123,
    toolCall: {
      serverId: "S1",
      toolName: "Search.Web",
      arguments: {
        q: "hello",
        limit: 10
      }
    }
  },
  context: {
    tenantId: "tenant-a",
    environment: "prod",
    sessionId: "session-1",
    userId: "user-1",
    agentId: "agent-1",
    orgRoles: ["owner"],
    scopes: [" Admin ", "read:ALL", "", "admin", "Read:all "],
    sourceIp: "203.0.113.10"
  },
  policyRules: [
    {
      ruleId: "b-rule",
      stage: "policy",
      status: "allow",
      conditionDsl: "allow_if_trusted",
      reasonCode: "ALLOW_TRUSTED",
      priority: 10
    },
    {
      ruleId: "a-rule",
      stage: "policy",
      status: "deny",
      conditionDsl: "deny_if_blocked",
      reasonCode: "DENY_BLOCKED",
      priority: 10
    },
    {
      ruleId: "c-rule",
      stage: "policy",
      status: "transform",
      conditionDsl: "mask_sensitive",
      reasonCode: "TRANSFORM_MASK",
      priority: 20
    }
  ],
  rateLimitRules: [
    {
      ruleId: "r3",
      dimension: "user",
      windowSeconds: 60,
      limit: 100,
      keyTemplate: "u:${userId}"
    },
    {
      ruleId: "r1",
      dimension: "agent",
      windowSeconds: 60,
      limit: 20,
      keyTemplate: "a:${agentId}"
    },
    {
      ruleId: "r2",
      dimension: "agent",
      windowSeconds: 30,
      limit: 20,
      keyTemplate: "a:${agentId}"
    }
  ],
  toolCatalog: [
    {
      serverId: "s2",
      toolName: "ztool",
      description: "z",
      visibility: "public",
      scopeRequirements: []
    },
    {
      serverId: "s1",
      toolName: "btool",
      description: "b",
      visibility: "restricted",
      scopeRequirements: ["read:all"]
    },
    {
      serverId: "s1",
      toolName: "atool",
      description: "a",
      visibility: "private",
      scopeRequirements: []
    }
  ],
  redactionRules: [
    {
      ruleId: "rr2",
      mode: "drop",
      matchPath: "$.payload.secret",
      replacement: ""
    },
    {
      ruleId: "rr1",
      mode: "mask",
      matchPath: "$.payload.password",
      replacement: "***"
    },
    {
      ruleId: "rr1",
      mode: "hash",
      matchPath: "$.payload.token",
      replacement: "sha256"
    }
  ],
  pricing: {
    inputTokenPriceUsd: 0.001,
    outputTokenPriceUsd: 0.002,
    requestBaseFeeUsd: 0.05
  },
  usageSnapshot: {
    tokenEstimateInput: 120,
    tokenEstimateOutput: 45,
    historicalCallsInWindow: {
      "user:user-1": 3
    },
    windowStartEpochMs: 1700000000000
  }
};

const MINIMAL_INPUT_NO_HINT: RawProxyInvocationV1 = {
  envelope: {
    protocolVersion: "2025-01-01",
    requestId: "req-min",
    method: "PING",
    transport: "stdio",
    receivedAtEpochMs: 1700000001000,
    toolCall: {
      serverId: "local",
      toolName: "Echo",
      arguments: {}
    }
  },
  context: {
    tenantId: "tenant-min",
    environment: "dev",
    sessionId: "s-min",
    userId: "u-min",
    agentId: "a-min",
    orgRoles: [],
    scopes: ["   "],
    sourceIp: "127.0.0.1"
  },
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: {
    inputTokenPriceUsd: 0,
    outputTokenPriceUsd: 0,
    requestBaseFeeUsd: 0
  },
  usageSnapshot: {
    tokenEstimateInput: 0,
    tokenEstimateOutput: 0,
    historicalCallsInWindow: {},
    windowStartEpochMs: 1700000001000
  }
};

const MALFORMED_ARGUMENTS_INPUT: RawProxyInvocationV1 = {
  envelope: {
    protocolVersion: "2025-01-01",
    requestId: "req-bad-args",
    method: "TOOLS/CALL",
    transport: "ws",
    receivedAtEpochMs: 1700000002000,
    toolCall: {
      serverId: "svc",
      toolName: "broken.args",
      arguments: [] as unknown as Record<string, unknown>
    }
  },
  context: {
    tenantId: "tenant-bad",
    environment: "staging",
    sessionId: "s-bad",
    userId: "u-bad",
    agentId: "a-bad",
    orgRoles: [],
    scopes: ["Read", " read "],
    sourceIp: "198.51.100.4"
  },
  policyRules: [],
  rateLimitRules: [],
  toolCatalog: [],
  redactionRules: [],
  pricing: {
    inputTokenPriceUsd: 1,
    outputTokenPriceUsd: 2,
    requestBaseFeeUsd: 3
  },
  usageSnapshot: {
    tokenEstimateInput: 7,
    tokenEstimateOutput: 8,
    historicalCallsInWindow: {
      bad: 1
    },
    windowStartEpochMs: 1700000002000
  }
};

export const TEST_VECTORS: RequestNormalizerVector[] = [
  {
    name: "normalizes with hint, canonical ordering, and normalized scopes",
    input: HAPPY_PATH_WITH_HINT_INPUT,
    expected: {
      invocationId: "e557c25143b000cfca00a7f1a47c1539c531902d7e338a1fd1c2932de63563f9",
      traceId: "8db2e68659ffb06e2da009705e48fada9e7e1df7332bea4e8e82f6949335bd2b",
      normalizedMethod: "tools/call",
      normalizedToolName: "search.web",
      tenantId: "tenant-a",
      userId: "user-1",
      agentId: "agent-1",
      scopes: ["admin", "read:all"],
      requestPayload: {
        q: "hello",
        limit: 10
      },
      requestTokenEstimate: 120,
      responseTokenEstimate: 45,
      policyRules: [
        {
          ruleId: "c-rule",
          stage: "policy",
          status: "transform",
          conditionDsl: "mask_sensitive",
          reasonCode: "TRANSFORM_MASK",
          priority: 20
        },
        {
          ruleId: "a-rule",
          stage: "policy",
          status: "deny",
          conditionDsl: "deny_if_blocked",
          reasonCode: "DENY_BLOCKED",
          priority: 10
        },
        {
          ruleId: "b-rule",
          stage: "policy",
          status: "allow",
          conditionDsl: "allow_if_trusted",
          reasonCode: "ALLOW_TRUSTED",
          priority: 10
        }
      ],
      rateLimitRules: [
        {
          ruleId: "r2",
          dimension: "agent",
          windowSeconds: 30,
          limit: 20,
          keyTemplate: "a:${agentId}"
        },
        {
          ruleId: "r1",
          dimension: "agent",
          windowSeconds: 60,
          limit: 20,
          keyTemplate: "a:${agentId}"
        },
        {
          ruleId: "r3",
          dimension: "user",
          windowSeconds: 60,
          limit: 100,
          keyTemplate: "u:${userId}"
        }
      ],
      toolCatalog: [
        {
          serverId: "s1",
          toolName: "atool",
          description: "a",
          visibility: "private",
          scopeRequirements: []
        },
        {
          serverId: "s1",
          toolName: "btool",
          description: "b",
          visibility: "restricted",
          scopeRequirements: ["read:all"]
        },
        {
          serverId: "s2",
          toolName: "ztool",
          description: "z",
          visibility: "public",
          scopeRequirements: []
        }
      ],
      redactionRules: [
        {
          ruleId: "rr1",
          mode: "mask",
          matchPath: "$.payload.password",
          replacement: "***"
        },
        {
          ruleId: "rr1",
          mode: "hash",
          matchPath: "$.payload.token",
          replacement: "sha256"
        },
        {
          ruleId: "rr2",
          mode: "drop",
          matchPath: "$.payload.secret",
          replacement: ""
        }
      ],
      pricing: {
        inputTokenPriceUsd: 0.001,
        outputTokenPriceUsd: 0.002,
        requestBaseFeeUsd: 0.05
      },
      historicalCallsInWindow: {
        "user:user-1": 3
      },
      windowStartEpochMs: 1700000000000
    }
  },
  {
    name: "handles minimal input with no hint and empty arrays",
    input: MINIMAL_INPUT_NO_HINT,
    expected: {
      invocationId: "fb741eca89120326763c305120c2624a1ae961461b25d5f140d8a002caccd70f",
      traceId: "2b4d0eb2e9a533fe2a1179d7c9793594a008f0fcb1692ddcae1790b54a016d28",
      normalizedMethod: "ping",
      normalizedToolName: "echo",
      tenantId: "tenant-min",
      userId: "u-min",
      agentId: "a-min",
      scopes: [],
      requestPayload: {},
      requestTokenEstimate: 0,
      responseTokenEstimate: 0,
      policyRules: [],
      rateLimitRules: [],
      toolCatalog: [],
      redactionRules: [],
      pricing: {
        inputTokenPriceUsd: 0,
        outputTokenPriceUsd: 0,
        requestBaseFeeUsd: 0
      },
      historicalCallsInWindow: {},
      windowStartEpochMs: 1700000001000
    }
  },
  {
    name: "recovers from malformed tool arguments by emitting empty payload",
    input: MALFORMED_ARGUMENTS_INPUT,
    expected: {
      invocationId: "be965c655e2e0883f12754d591a18fe28363772d1c37fbf5fbd718ab13eb7a15",
      traceId: "9bfddb2e0470abd39591a9daf58bea5307422408f96494fe6b0836598d828d10",
      normalizedMethod: "tools/call",
      normalizedToolName: "broken.args",
      tenantId: "tenant-bad",
      userId: "u-bad",
      agentId: "a-bad",
      scopes: ["read"],
      requestPayload: {},
      requestTokenEstimate: 7,
      responseTokenEstimate: 8,
      policyRules: [],
      rateLimitRules: [],
      toolCatalog: [],
      redactionRules: [],
      pricing: {
        inputTokenPriceUsd: 1,
        outputTokenPriceUsd: 2,
        requestBaseFeeUsd: 3
      },
      historicalCallsInWindow: {
        bad: 1
      },
      windowStartEpochMs: 1700000002000
    }
  }
];
