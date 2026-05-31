import { describe, it, expect } from "vitest";
import { buildReport, summarize, toMarkdown } from "../../src/report/reporter.js";
import type { ScenarioResult } from "../../src/engine/types.js";

const results: ScenarioResult[] = [
  {
    scenario: "A",
    priority: "critical",
    overall: "pass",
    durationMs: 10,
    executedAt: "t",
    steps: [
      {
        stepId: "s1",
        intent: "確認",
        overall: "pass",
        screenshotPath: null,
        executedAt: "t",
        checkpoints: [{ element: "E", expect: "x", judgment: "pass", reason: "ok" }],
      },
    ],
  },
  {
    scenario: "B",
    priority: "high",
    overall: "fail",
    durationMs: 20,
    executedAt: "t",
    steps: [
      {
        stepId: "s1",
        intent: "確認2",
        overall: "fail",
        screenshotPath: null,
        executedAt: "t",
        checkpoints: [{ element: "F", expect: "y", judgment: "fail", reason: "未描画" }],
      },
    ],
  },
];

describe("reporter", () => {
  it("summarize はpass/fail/warnを集計する", () => {
    expect(summarize(results)).toEqual({ total: 2, pass: 1, fail: 1, warn: 0 });
  });

  it("buildReport は総合判定をfailに集約しIDを付与する", () => {
    const report = buildReport(results, { reportId: "r1", generatedAt: "now" });
    expect(report.reportId).toBe("r1");
    expect(report.overall).toBe("fail");
    expect(report.summary.total).toBe(2);
  });

  it("toMarkdown は主要情報を含む", () => {
    const md = toMarkdown(buildReport(results, { reportId: "r1", generatedAt: "now" }));
    expect(md).toContain("Agentic VRT Report");
    expect(md).toContain("[FAIL] B (high)");
    expect(md).toContain("未描画");
  });
});
