import type { ProgramDefinition } from "../../contracts/program-definition.types";

const SELF_REF = {
  projectId: "mcp-middleware-platform",
  definitionId: "mcp-middleware-platform.definition.v1",
  version: "v1"
} as const;

/**
 * MCP MIDDLEWARE PLATFORM
 *
 * MCP (Model Context Protocol) has no middleware/interceptor layer. Enterprises deploying
 * AI agents at scale need: auth/policy enforcement, observability (OTel tracing),
 * rate limiting, cost metering, data redaction, and tool filtering. The protocol
 * (SEP-1763 draft) confirms this gap - there's no standard way to intercept, inspect,
 * or control MCP traffic.
 *
 * This program is a proxy that sits between MCP clients and servers, providing a
 * pluggable middleware chain for governance, visibility, and control.
 *
 * MARKET EVIDENCE:
 *
 * Pass 10 (444 signals, 3 rounds):
 * - MCP has no interceptor/middleware layer (SEP-1763 draft confirms gap)
 * - OTel can't distinguish MCP tool calls (known bug)
 * - Rate limiting absent (Figma 429s reported)
 * - Tool definitions eat 7-15% of context window with no filtering
 * - No cost metering, no data redaction, no audit trail
 *
 * Pass 13 (160 signals, 1 round):
 * - MCP context consumption: 67K tokens (33.7%) by 7 servers - lazy loading demand
 * - MCP logging/observability: third-party tools emerging
 * - MCP security scanning: Agent Audit launched
 * - Scope-based permissions: AgentUp does oauth2/jwt with tool scopes
 *
 * COMPETITIVE LANDSCAPE:
 * - Docker MCP Gateway (72v): container runtime focus, runs MCP servers NOT middleware
 * - supergateway: basic multiplexing only
 * - theopenco/llmgateway: asked to add MCP support
 * - No dominant player owns the middleware layer
 *
 * BUYER: Enterprise platform/security teams deploying AI agents at scale
 * BUDGET: Enterprise security + platform engineering budgets, SOC2/compliance mandates
 * DURABILITY: Structural protocol gap - MCP spec has no middleware concept
 */

export const program = {
  meta: {
    name: "MCP Middleware Platform",
    tagline: "Pluggable governance layer for MCP-powered AI agents",
    category: ["infrastructure", "developer-tools", "enterprise"],
    stage: "definition" as const,
    ...SELF_REF
  },

  lineage: {
    parentProjects: ["agent-policy-engine"],
    derivedFrom: ["mcp-middleware-engine"],
    researchPasses: [10, 13]
  },

  organism: {
    archetype: "infrastructure-proxy",
    coreLoop: "Intercept MCP tool calls → Apply middleware chain → Forward/transform/deny → Log observability",
    differentiation: "First full-stack MCP middleware with pluggable policy, tracing, rate-limits, redaction, filtering"
  },

  environment: {
    systems: [
      {
        id: "mcp-client",
        type: "mcp-client",
        description: "AI agent or MCP client making tool calls",
        actors: [
          { id: "agent", role: "initiator", description: "AI agent (Claude Code, OpenClaw, LangChain, custom)" },
          { id: "user", role: "context", description: "End user on whose behalf agent acts" },
          { id: "platform-team", role: "operator", description: "Team deploying and managing the agent" }
        ]
      },
      {
        id: "mcp-server",
        type: "mcp-server",
        description: "MCP tool server receiving calls",
        actors: [
          { id: "tool-provider", role: "provider", description: "Owner of the MCP server/tools" }
        ]
      },
      {
        id: "policy-engine",
        type: "policy-engine",
        description: "External or embedded policy decision service",
        actors: [
          { id: "security-team", role: "author", description: "Defines security policies" }
        ]
      },
      {
        id: "observability-backend",
        type: "observability-backend",
        description: "OTel-compatible tracing/metrics sink",
        actors: [
          { id: "platform-team", role: "consumer", description: "Views traces and metrics" }
        ]
      }
    ],
    filters: [
      {
        id: "auth-filter",
        system: "mcp-client",
        description: "Validates credentials, session, user permissions"
      },
      {
        id: "policy-filter",
        system: "policy-engine",
        description: "Evaluates tool call against declared policy rules"
      },
      {
        id: "trace-filter",
        system: "observability-backend",
        description: "Extracts spans, metrics from tool calls for OTel"
      },
      {
        id: "rate-limit-filter",
        system: "mcp-client",
        description: "Throttles calls per user/agent/tool scope"
      },
      {
        id: "cost-metering-filter",
        system: "observability-backend",
        description: "Tracks token usage, call counts, computes costs"
      },
      {
        id: "redaction-filter",
        system: "mcp-server",
        description: "Masks sensitive data in request/response"
      },
      {
        id: "tool-filter",
        system: "mcp-client",
        description: "Filters tools by visibility, summarizes descriptions"
      }
    ]
  },

  functions: [
    {
      id: "proxy-handler",
      description: "Main proxy entry point - accepts MCP envelopes, routes through middleware chain",
      dependencies: ["auth-filter", "policy-filter"]
    },
    {
      id: "process-supervisor-governor",
      description: "Validates child-process spawn commands, restart policy, and isolation defaults before launch",
      kind: "input",
      dependencies: ["policy-filter"]
    },
    {
      id: "authenticator",
      description: "Validates JWT/OAuth2 tokens, session state, user context",
      kind: "input",
      dependencies: ["auth-filter"]
    },
    {
      id: "policy-evaluator",
      description: "Evaluates tool call against policy bundle (allow/deny/transform)",
      kind: "input",
      dependencies: ["policy-filter"]
    },
    {
      id: "tracer",
      description: "Extracts OTel spans from MCP calls, exports to backend",
      kind: "signal",
      dependencies: ["trace-filter"]
    },
    {
      id: "rate-limiter",
      description: "Applies throttling rules per scope (user/agent/tool)",
      kind: "input",
      dependencies: ["rate-limit-filter"]
    },
    {
      id: "cost-meter",
      description: "Tracks token consumption, call counts, computes cost per user/agent",
      kind: "output",
      dependencies: ["cost-metering-filter"]
    },
    {
      id: "redactor",
      description: "Masks PII/secrets in tool arguments and responses",
      kind: "input",
      dependencies: ["redaction-filter"]
    },
    {
      id: "tool-filter",
      description: "Controls tool visibility, summarizes descriptions to save context",
      kind: "input",
      dependencies: ["tool-filter"]
    }
  ],

  exchange: {
    acquisition: [
      {
        channel: "direct-sales",
        buyer: "Enterprise security/platform teams",
        trigger: "SOC2 audit, EU AI Act compliance, agent deployment freeze"
      },
      {
        channel: "developer-community",
        buyer: "DevRel / Platform engineers",
        trigger: "Open source adoption, developer ergonomics"
      }
    ],
    payment: [
      {
        model: "subscription",
        tiers: [
          { name: "starter", price: 99, features: ["auth", "basic logging", "5k calls/day"] },
          { name: "pro", price: 499, features: ["full middleware", "OTel", "rate limits", "50k calls/day"] },
          { name: "enterprise", price: "custom", features: ["unlimited", "on-prem", "SLA", "custom policies"] }
        ]
      }
    ]
  },

  strategy: {
    approach: "Build auth slice from agent-policy-engine, add middleware components iteratively",
    artifact: "MCP proxy server with pluggable middleware chain and supervised child-process runtime",
    minimumViableScope: "Auth + basic logging + tool filtering + supervised stdio child-process launch",
    capacityCeiling: "Full middleware platform with all 7 filters plus enterprise process governance",
    dependencies: [
      { id: "agent-policy-engine", kind: "input", description: "Policy enforcement logic to reuse" },
      { id: "mcp-types", kind: "input", description: "@modelcontextprotocol/types SDK" },
      { id: "otel-sdk", kind: "input", description: "@opentelemetry/sdk for tracing" }
    ],
    failureModes: [
      "MCP protocol adds native middleware - would need to adapt to standard",
      "Cloud providers add MCP governance to API Gateway - would need platform partnership",
      "Enterprise builds internal proxy - would need to win on developer experience"
    ]
  }
} satisfies ProgramDefinition;
