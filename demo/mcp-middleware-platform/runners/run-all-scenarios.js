import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const runnersDir = here;
const scenariosDir = resolve(here, "..", "scenarios");

const scenarios = readdirSync(scenariosDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

let failures = 0;

for (const scenario of scenarios) {
  console.log(`\n=== Scenario: ${scenario} ===`);
  const result = spawnSync("node", [resolve(runnersDir, "run-scenario.js"), scenario], {
    stdio: "inherit"
  });
  if ((result.status ?? 1) !== 0) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} scenario(s) failed.`);
  process.exit(1);
}

console.log("\nAll scenarios completed.");
