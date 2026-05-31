import {
  buildReport,
  runScenario,
  type BrowserController,
  type Judge,
  type RegressionReport,
  type Scenario,
  type ScenarioResult,
} from "@taylormode-lab/agentic-vrt-core";
import type { StartedServer, VrtAdapter } from "./adapter.js";

export interface JudgeFactoryContext {
  browser: BrowserController;
  serverLogPath?: string;
  screenshotPath: string;
}

export interface RunOptions {
  adapter: VrtAdapter;
  scenarios: Scenario[];
  createBrowser: () => Promise<BrowserController>;
  createJudge: (ctx: JudgeFactoryContext) => Judge;
  screenshotPathFor: (scenario: string, stepId: string) => string;
  onReport?: (report: RegressionReport) => Promise<void> | void;
  logger?: (msg: string) => void;
}

export interface RunOutcome {
  report: RegressionReport;
  exitCode: number;
}

/** started.baseUrl があればシナリオの baseUrl を上書きする。 */
export function applyBaseUrl(scenario: Scenario, baseUrl?: string): Scenario {
  if (!baseUrl) return scenario;
  return {
    ...scenario,
    preconditions: { ...scenario.preconditions, baseUrl },
  };
}

/**
 * VRT のライフサイクルを管理して実行する。
 * teardown / restoreEnv は finally で必ず実行され、env 復元漏れを防ぐ。
 */
export async function runCli(opts: RunOptions): Promise<RunOutcome> {
  const log = opts.logger ?? (() => {});
  const results: ScenarioResult[] = [];

  await opts.adapter.prepareEnv?.();
  try {
    let started: StartedServer | undefined;
    if (opts.adapter.startServer) {
      started = await opts.adapter.startServer();
      log(`[adapter] server ready: ${started.baseUrl}`);
    }
    await opts.adapter.seed?.();

    const browser = await opts.createBrowser();
    try {
      for (const sc of opts.scenarios) {
        const scenario = applyBaseUrl(sc, started?.baseUrl);
        log(`[run] scenario: ${scenario.scenario}`);
        const judge = opts.createJudge({
          browser,
          ...(started?.serverLogPath !== undefined
            ? { serverLogPath: started.serverLogPath }
            : {}),
          screenshotPath: opts.screenshotPathFor(scenario.scenario, "_judge"),
        });
        const result = await runScenario(scenario, {
          browser,
          judge,
          screenshotPathFor: opts.screenshotPathFor,
        });
        log(`[run] ${scenario.scenario} => ${result.overall}`);
        results.push(result);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await opts.adapter.teardown?.();
    await opts.adapter.restoreEnv?.();
    log(`[adapter] teardown / restoreEnv done`);
  }

  const report = buildReport(results);
  await opts.onReport?.(report);
  return { report, exitCode: report.overall === "fail" ? 1 : 0 };
}
