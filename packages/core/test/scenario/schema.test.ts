import { describe, it, expect } from "vitest";
import { parseScenario, scenarioSchema } from "../../src/scenario/schema.js";

const validYaml = `
scenario: 管理ダッシュボード
priority: critical
description: 収益ダッシュボードの検証
preconditions:
  baseUrl: http://localhost:3333
steps:
  - id: mrr
    intent: MRR推移チャートが描画されているか確認する
    navigate: /admin
    actions:
      - type: wait_for
        selector: "#mrr-chart"
        timeoutMs: 8000
    checkpoints:
      - element: MRR推移チャート
        expect: MRR推移の折れ線グラフが描画されている
`;

describe("parseScenario", () => {
  it("正しいYAMLを意図ベースScenarioに変換する", () => {
    const sc = parseScenario(validYaml);
    expect(sc.scenario).toBe("管理ダッシュボード");
    expect(sc.priority).toBe("critical");
    expect(sc.steps).toHaveLength(1);
    expect(sc.steps[0]!.intent).toContain("MRR推移");
    expect(sc.steps[0]!.actions?.[0]).toEqual({
      type: "wait_for",
      selector: "#mrr-chart",
      timeoutMs: 8000,
    });
  });

  it("checkpoints が無いステップは拒否する", () => {
    const bad = `
scenario: x
priority: high
steps:
  - id: s1
    intent: なにか
    checkpoints: []
`;
    expect(() => parseScenario(bad)).toThrow();
  });

  it("未知の priority は拒否する", () => {
    const r = scenarioSchema.safeParse({
      scenario: "x",
      priority: "urgent",
      steps: [{ id: "s", intent: "i", checkpoints: [{ element: "e", expect: "x" }] }],
    });
    expect(r.success).toBe(false);
  });

  it("未知の action type は拒否する", () => {
    const bad = `
scenario: x
priority: low
steps:
  - id: s1
    intent: i
    actions:
      - type: teleport
        selector: x
    checkpoints:
      - element: e
        expect: x
`;
    expect(() => parseScenario(bad)).toThrow();
  });
});
