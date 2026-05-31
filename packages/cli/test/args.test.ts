import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("既定値を返す", () => {
    const a = parseArgs([]);
    expect(a.scenarioDir).toBe("vrt/scenarios");
    expect(a.reportDir).toBe("vrt/reports");
    expect(a.model).toBe("claude-sonnet-4-6");
    expect(a.maxIterations).toBe(8);
    expect(a.scenarioFilter).toBeUndefined();
  });

  it("各オプションを解釈する", () => {
    const a = parseArgs([
      "--scenario-dir", "s",
      "--report-dir", "r",
      "--scenario", "管理ダッシュボード",
      "--base-url", "http://localhost:3333",
      "--adapter", "./adapter.js",
      "--server-log", "/tmp/s.log",
      "--model", "claude-x",
      "--max-iterations", "5",
    ]);
    expect(a).toEqual({
      scenarioDir: "s",
      reportDir: "r",
      scenarioFilter: "管理ダッシュボード",
      baseUrl: "http://localhost:3333",
      adapterPath: "./adapter.js",
      serverLogPath: "/tmp/s.log",
      model: "claude-x",
      maxIterations: 5,
    });
  });

  it("未知オプション・値欠落はエラー", () => {
    expect(() => parseArgs(["--nope"])).toThrow();
    expect(() => parseArgs(["--scenario"])).toThrow();
  });
});
