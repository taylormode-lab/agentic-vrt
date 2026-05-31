import { describe, it, expect, vi } from "vitest";
import type { BrowserController } from "../../src/browser/types.js";
import type { Checkpoint, CheckpointResult } from "../../src/contracts.js";
import { resolveUrl, runScenario, type Judge } from "../../src/engine/run-engine.js";
import type { Scenario } from "../../src/scenario/schema.js";

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
      base64: "B64",
      fullPage: o.fullPage ?? false,
    })),
    getConsoleLogs: vi.fn(async () => []),
    queryDom: vi.fn(async () => ({ found: true, text: "", count: 1 })),
    getPageContent: vi.fn(async () => ""),
    getPageUrl: vi.fn(async () => ""),
    close: vi.fn(async () => {}),
  };
}

// intent で結果を切り替えるフェイク judge
function makeJudge(map: Record<string, CheckpointResult["judgment"]>): Judge {
  return {
    judge: vi.fn(async (input: { intent: string; checkpoints: Checkpoint[] }) =>
      input.checkpoints.map((c) => ({
        element: c.element,
        expect: c.expect,
        judgment: map[input.intent] ?? "pass",
        reason: `judged:${input.intent}`,
      })),
    ),
  };
}

describe("resolveUrl", () => {
  it("絶対URLはそのまま", () => {
    expect(resolveUrl("http://x", "https://abs/p")).toBe("https://abs/p");
  });
  it("相対パスはbaseUrlと結合（重複スラッシュを正規化）", () => {
    expect(resolveUrl("http://localhost:3333/", "/admin")).toBe("http://localhost:3333/admin");
  });
  it("baseUrl未指定なら相対のまま", () => {
    expect(resolveUrl(undefined, "/admin")).toBe("/admin");
  });
});

const scenario: Scenario = {
  scenario: "ダッシュボード",
  priority: "critical",
  preconditions: { baseUrl: "http://localhost:3333" },
  steps: [
    {
      id: "summary",
      intent: "サマリー確認",
      navigate: "/admin",
      actions: [{ type: "click", selector: "#open" }],
      checkpoints: [{ element: "MRR", expect: "MRRが見える" }],
    },
    {
      id: "chart",
      intent: "チャート確認",
      checkpoints: [{ element: "MRR推移", expect: "折れ線が見える" }],
    },
  ],
};

describe("runScenario", () => {
  it("navigate解決・action実行・ステップごとにjudgeを呼び、総合判定を集約する", async () => {
    const browser = makeBrowser();
    const judge = makeJudge({ サマリー確認: "pass", チャート確認: "fail" });
    const fixedNow = () => new Date("2026-05-31T00:00:00Z");

    const result = await runScenario(scenario, { browser, judge, now: fixedNow });

    expect(browser.navigate).toHaveBeenCalledWith("http://localhost:3333/admin");
    expect(browser.click).toHaveBeenCalledWith("#open");
    expect(judge.judge).toHaveBeenCalledTimes(2);
    expect(result.steps[0]!.overall).toBe("pass");
    expect(result.steps[1]!.overall).toBe("fail");
    // どこかに fail があればシナリオ総合は fail
    expect(result.overall).toBe("fail");
    // navigate未指定の step2 では navigate は1回だけ（step1分）
    expect(browser.navigate).toHaveBeenCalledTimes(1);
  });

  it("screenshotPathFor を与えると各ステップで fullPage 撮影し screenshotPath を記録する", async () => {
    const browser = makeBrowser();
    const judge = makeJudge({});
    const result = await runScenario(scenario, {
      browser,
      judge,
      screenshotPathFor: (s, id) => `/tmp/${s}-${id}.png`,
    });
    expect(browser.screenshot).toHaveBeenCalledTimes(2);
    expect(browser.screenshot).toHaveBeenCalledWith({ path: "/tmp/ダッシュボード-summary.png", fullPage: true });
    expect(result.steps[0]!.screenshotPath).toBe("/tmp/ダッシュボード-summary.png");
  });
});
