import type { ProxyProcessSpawnDecisionV1, ProxyProcessSpawnRequestV1 } from "../../artifacts";
import { evaluateProxyProcessSpawn } from "../index";

export type ProxyProcessGovernorTestVector = {
  name: string;
  input: ProxyProcessSpawnRequestV1;
  expected: ProxyProcessSpawnDecisionV1;
};

const BASE_INPUT: ProxyProcessSpawnRequestV1 = {
  proxyCommand: "node ./servers/crm-mcp.js",
  transport: "stdio",
  serverProfileId: "crm-default",
  tenantId: "tenant-acme",
  allowedCommandPrefixes: ["node", "npx"],
  maxRestarts: 3,
  restartBackoffMs: 1000,
  killTimeoutMs: 3000
};

export const TEST_VECTORS: ProxyProcessGovernorTestVector[] = [
  {
    name: "allows command when first token matches allowlist prefix",
    input: BASE_INPUT,
    expected: evaluateProxyProcessSpawn(BASE_INPUT)
  },
  {
    name: "normalizes whitespace and still allows matching command",
    input: {
      ...BASE_INPUT,
      proxyCommand: "  node    ./servers/crm-mcp.js   "
    },
    expected: evaluateProxyProcessSpawn({
      ...BASE_INPUT,
      proxyCommand: "  node    ./servers/crm-mcp.js   "
    })
  },
  {
    name: "denies empty command",
    input: {
      ...BASE_INPUT,
      proxyCommand: "   "
    },
    expected: evaluateProxyProcessSpawn({
      ...BASE_INPUT,
      proxyCommand: "   "
    })
  },
  {
    name: "denies disallowed first token",
    input: {
      ...BASE_INPUT,
      proxyCommand: "bash ./servers/crm-mcp.sh"
    },
    expected: evaluateProxyProcessSpawn({
      ...BASE_INPUT,
      proxyCommand: "bash ./servers/crm-mcp.sh"
    })
  },
  {
    name: "clamps restart and timeout policy into deterministic bounds",
    input: {
      ...BASE_INPUT,
      maxRestarts: -3,
      restartBackoffMs: 999999,
      killTimeoutMs: 1
    },
    expected: evaluateProxyProcessSpawn({
      ...BASE_INPUT,
      maxRestarts: -3,
      restartBackoffMs: 999999,
      killTimeoutMs: 1
    })
  }
];
