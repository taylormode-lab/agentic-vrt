#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  JudgeAgent,
  PuppeteerBrowserController,
  createAnthropicLlmClient,
  loadScenarioDir,
  toMarkdown,
  type BrowserController,
} from "@taylormode-lab/agentic-vrt-core";
import { parseArgs } from "./args.js";
import { filterScenarios } from "./filter.js";
import { runCli } from "./run.js";
import type { VrtAdapter } from "./adapter.js";

function sanitize(value: string): string {
  return value.replace(/[^\w.\-]+/g, "_");
}

async function loadAdapter(path?: string): Promise<VrtAdapter> {
  if (!path) return { name: "noop" };
  const mod = (await import(pathToFileURL(resolve(path)).href)) as {
    default?: VrtAdapter;
    adapter?: VrtAdapter;
  };
  const adapter = mod.default ?? mod.adapter;
  if (!adapter) {
    throw new Error(`adapter module '${path}' must export default or 'adapter'`);
  }
  return adapter;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");

  const all = await loadScenarioDir(args.scenarioDir);
  const scenarios = filterScenarios(all, args.scenarioFilter);
  if (scenarios.length === 0) throw new Error("no scenarios matched the filter");

  const adapter = await loadAdapter(args.adapterPath);
  await mkdir(args.reportDir, { recursive: true });

  const outcome = await runCli({
    adapter,
    scenarios,
    createBrowser: async (): Promise<BrowserController> => {
      const browser = new PuppeteerBrowserController();
      await browser.launch();
      return browser;
    },
    createJudge: ({ browser, serverLogPath, screenshotPath }) => {
      const resolvedServerLog = serverLogPath ?? args.serverLogPath;
      return new JudgeAgent({
        llm: createAnthropicLlmClient({ apiKey, model: args.model }),
        browser,
        config: {
          screenshotPath,
          maxIterations: args.maxIterations,
          ...(resolvedServerLog !== undefined ? { serverLogPath: resolvedServerLog } : {}),
        },
      });
    },
    screenshotPathFor: (scenario, stepId) =>
      join(args.reportDir, `${sanitize(scenario)}__${sanitize(stepId)}.png`),
    onReport: async (report) => {
      await writeFile(
        join(args.reportDir, "report.json"),
        JSON.stringify(report, null, 2),
      );
      await writeFile(join(args.reportDir, "report.md"), toMarkdown(report));
    },
    logger: (m) => console.log(m),
  });

  console.log(
    `overall: ${outcome.report.overall} (pass=${outcome.report.summary.pass} fail=${outcome.report.summary.fail} warn=${outcome.report.summary.warn})`,
  );
  process.exit(outcome.exitCode);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
