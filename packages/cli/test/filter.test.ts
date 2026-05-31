import { describe, it, expect } from "vitest";
import type { Scenario } from "@taylormode-lab/agentic-vrt-core";
import { filterScenarios } from "../src/filter.js";

const mk = (name: string, priority: Scenario["priority"]): Scenario => ({
  scenario: name,
  priority,
  steps: [{ id: "s", intent: "i", checkpoints: [{ element: "e", expect: "x" }] }],
});

const scenarios = [mk("管理ダッシュボード", "critical"), mk("ログイン", "high"), mk("請求", "critical")];

describe("filterScenarios", () => {
  it("filter未指定は全件", () => {
    expect(filterScenarios(scenarios)).toHaveLength(3);
  });
  it("シナリオ名の部分一致", () => {
    expect(filterScenarios(scenarios, "ダッシュ").map((s) => s.scenario)).toEqual(["管理ダッシュボード"]);
  });
  it("priority完全一致", () => {
    expect(filterScenarios(scenarios, "critical").map((s) => s.scenario)).toEqual([
      "管理ダッシュボード",
      "請求",
    ]);
  });
});
