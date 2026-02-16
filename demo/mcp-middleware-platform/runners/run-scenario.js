import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const demoRoot = resolve(here, "..");
const projectRoot = resolve(demoRoot, "..", "..");
const scenariosDir = resolve(demoRoot, "scenarios");

const scenarioArg = process.argv[2] ?? "clean.json";
const scenarioPath = resolve(scenariosDir, scenarioArg);

if (!scenarioArg.endsWith(".json")) {
  console.error("Scenario must be a .json file in demo/mcp-middleware-platform/scenarios");
  process.exit(1);
}

const availableScenarios = readdirSync(scenariosDir).filter((name) => name.endsWith(".json"));
if (!availableScenarios.includes(scenarioArg)) {
  console.error(`Unknown scenario: ${scenarioArg}`);
  console.error(`Available: ${availableScenarios.join(", ")}`);
  process.exit(1);
}

const result = spawnSync("node", ["--import", "tsx", "./cli.ts", scenarioPath], {
  cwd: projectRoot,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
