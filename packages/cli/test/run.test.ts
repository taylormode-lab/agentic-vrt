import { describe, it, expect, vi } from "vitest";
import type {
  BrowserController,
  Checkpoint,
  CheckpointResult,
  Judge,
  Scenario,
} from "@taylormode-lab/agentic-vrt-core";
import { applyBaseUrl, runCli } from "../src/run.js";
import type { VrtAdapter } from "../src/adapter.js";

function makeBrowser(): BrowserController {
  return {
    navigate: vi.fn(async () => {}),
    waitForSelector: vi.fn(async () => true),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    scrollToText: vi.fn(async () => ({ matched: 1, strategy: "text" as const, scrolled: true })),
    scrollToSelector: vi.fn(async () => ({ matched: 1, strategy: "selector" as const, scrolled: true })),
    screenshot: vi.fn(async (o: { path: string; fullPage?: boolean }) => ({
      path: o.path,
      base64: "B",
      fullPage: o.fullPage ?? false,
    })),
    getConsoleLogs: vi.fn(async () => []),
    queryDom: vi.fn(async () => ({ found: true, text: "", count: 1 })),
    getPageContent: vi.fn(async () => ""),
    getPageUrl: vi.fn(async () => ""),
    clearSession: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

const scenario: Scenario = {
  scenario: "S",
  priority: "critical",
  steps: [{ id: "s1", intent: "確認", checkpoints: [{ element: "E", expect: "x" }] }],
};

function passJudge(): Judge {
  return {
    judge: async (input: { intent: string; checkpoints: Checkpoint[] }): Promise<CheckpointResult[]> =>
      input.checkpoints.map((c) => ({ element: c.element, expect: c.expect, judgment: "pass", reason: "ok" })),
  };
}

describe("applyBaseUrl", () => {
  it("baseUrlを上書きする", () => {
    const out = applyBaseUrl(scenario, "http://x");
    expect(out.preconditions?.baseUrl).toBe("http://x");
  });
  it("未指定なら据え置き", () => {
    expect(applyBaseUrl(scenario, undefined)).toEqual(scenario);
  });
});

describe("runCli lifecycle", () => {
  it("prepareEnv→startServer→seed→teardown→restoreEnv の順で実行し、browserをcloseする", async () => {
    const order: string[] = [];
    const adapter: VrtAdapter = {
      name: "fake",
      prepareEnv: vi.fn(async () => { order.push("prepareEnv"); }),
      startServer: vi.fn(async () => { order.push("startServer"); return { baseUrl: "http://localhost:3333" }; }),
      seed: vi.fn(async () => { order.push("seed"); }),
      teardown: vi.fn(async () => { order.push("teardown"); }),
      restoreEnv: vi.fn(async () => { order.push("restoreEnv"); }),
    };
    const browser = makeBrowser();
    const outcome = await runCli({
      adapter,
      scenarios: [scenario],
      createBrowser: async () => browser,
      createJudge: () => passJudge(),
      screenshotPathFor: (s, id) => `/tmp/${s}-${id}.png`,
    });

    expect(order).toEqual(["prepareEnv", "startServer", "seed", "teardown", "restoreEnv"]);
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(outcome.report.overall).toBe("pass");
    expect(outcome.exitCode).toBe(0);
    // baseUrl が反映されて navigate されない step なので navigate は呼ばれない
  });

  it("実行中に例外が出ても teardown / restoreEnv は必ず実行される（env復元保証）", async () => {
    const order: string[] = [];
    const adapter: VrtAdapter = {
      name: "fake",
      prepareEnv: async () => { order.push("prepareEnv"); },
      teardown: async () => { order.push("teardown"); },
      restoreEnv: async () => { order.push("restoreEnv"); },
    };
    const browser = makeBrowser();
    const explodingJudge: Judge = {
      judge: async () => { throw new Error("judge boom"); },
    };

    await expect(
      runCli({
        adapter,
        scenarios: [scenario],
        createBrowser: async () => browser,
        createJudge: () => explodingJudge,
        screenshotPathFor: (s, id) => `/tmp/${s}-${id}.png`,
      }),
    ).rejects.toThrow("judge boom");

    expect(order).toContain("teardown");
    expect(order).toContain("restoreEnv");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("failがあればexitCode=1", async () => {
    const failJudge: Judge = {
      judge: async (input: { intent: string; checkpoints: Checkpoint[] }) =>
        input.checkpoints.map((c) => ({ element: c.element, expect: c.expect, judgment: "fail" as const, reason: "ng" })),
    };
    const outcome = await runCli({
      adapter: { name: "noop" },
      scenarios: [scenario],
      createBrowser: async () => makeBrowser(),
      createJudge: () => failJudge,
      screenshotPathFor: (s, id) => `/tmp/${s}-${id}.png`,
    });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.report.overall).toBe("fail");
  });
});
