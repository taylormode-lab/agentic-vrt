import type { BrowserController } from "../browser/types.js";
import type { Checkpoint, CheckpointResult } from "../contracts.js";
import type { Scenario, StepAction } from "../scenario/schema.js";
import { aggregateJudgments, determineOverallJudgment } from "./judgment.js";
import type { ScenarioResult, StepResult } from "./types.js";

/** 実行エンジンが依存する判定器の最小契約（JudgeAgent が構造的に満たす）。 */
export interface Judge {
  judge(input: { intent: string; checkpoints: Checkpoint[] }): Promise<CheckpointResult[]>;
}

export interface RunEngineDeps {
  browser: BrowserController;
  judge: Judge;
  /** 各ステップの証跡スクショ保存先。省略時は撮影しない。 */
  screenshotPathFor?: (scenario: string, stepId: string) => string;
  now?: () => Date;
}

/** baseUrl と target(絶対URL or 相対パス) から遷移先URLを解決する。 */
export function resolveUrl(baseUrl: string | undefined, target: string): string {
  if (/^https?:\/\//.test(target)) return target;
  if (!baseUrl) return target;
  return `${baseUrl.replace(/\/+$/, "")}/${target.replace(/^\/+/, "")}`;
}

async function dispatchAction(browser: BrowserController, action: StepAction): Promise<void> {
  switch (action.type) {
    case "click":
      await browser.click(action.selector);
      return;
    case "fill":
      await browser.fill(action.selector, action.value);
      return;
    case "wait_for":
      await browser.waitForSelector(action.selector, action.timeoutMs);
      return;
    case "scroll_to_text":
      await browser.scrollToText(action.text);
      return;
    case "scroll_to_selector":
      await browser.scrollToSelector(action.selector);
      return;
  }
}

export async function runScenario(
  scenario: Scenario,
  deps: RunEngineDeps,
): Promise<ScenarioResult> {
  const now = deps.now ?? (() => new Date());
  const startedAtMs = now().getTime();
  const startedAtIso = new Date(startedAtMs).toISOString();
  const baseUrl = scenario.preconditions?.baseUrl;
  const stepResults: StepResult[] = [];

  if (scenario.clear_session) {
    await deps.browser.clearSession();
  }

  for (const step of scenario.steps) {
    if (step.navigate !== undefined) {
      await deps.browser.navigate(resolveUrl(baseUrl, step.navigate));
    }
    for (const action of step.actions ?? []) {
      await dispatchAction(deps.browser, action);
    }

    const results = await deps.judge.judge({
      intent: step.intent,
      checkpoints: step.checkpoints,
    });

    let screenshotPath: string | null = null;
    if (deps.screenshotPathFor) {
      const target = deps.screenshotPathFor(scenario.scenario, step.id);
      const shot = await deps.browser.screenshot({ path: target, fullPage: true });
      screenshotPath = shot.path;
    }

    stepResults.push({
      stepId: step.id,
      intent: step.intent,
      checkpoints: results,
      overall: determineOverallJudgment(results),
      screenshotPath,
      executedAt: now().toISOString(),
    });
  }

  return {
    scenario: scenario.scenario,
    priority: scenario.priority,
    steps: stepResults,
    overall: aggregateJudgments(stepResults.map((s) => s.overall)),
    durationMs: now().getTime() - startedAtMs,
    executedAt: startedAtIso,
  };
}
