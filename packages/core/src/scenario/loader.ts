import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseScenario, type Scenario } from "./schema.js";

export async function loadScenarioFile(path: string): Promise<Scenario> {
  return parseScenario(await readFile(path, "utf-8"));
}

export async function loadScenarioDir(dir: string): Promise<Scenario[]> {
  const entries = await readdir(dir);
  const files = entries
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  const out: Scenario[] = [];
  for (const f of files) {
    out.push(await loadScenarioFile(join(dir, f)));
  }
  return out;
}
