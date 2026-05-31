import { describe, it, expect } from "vitest";
import { aggregateJudgments, determineOverallJudgment } from "../../src/engine/judgment.js";
import type { CheckpointResult } from "../../src/contracts.js";

const cp = (judgment: CheckpointResult["judgment"]): CheckpointResult => ({
  element: "e",
  expect: "x",
  judgment,
  reason: "r",
});

describe("determineOverallJudgment", () => {
  it("fail が1つでもあれば fail", () => {
    expect(determineOverallJudgment([cp("pass"), cp("fail"), cp("warning")])).toBe("fail");
  });
  it("fail が無く warning があれば warning", () => {
    expect(determineOverallJudgment([cp("pass"), cp("warning")])).toBe("warning");
  });
  it("全て pass なら pass", () => {
    expect(determineOverallJudgment([cp("pass"), cp("pass")])).toBe("pass");
  });
  it("空は warning（未検証は不審）", () => {
    expect(determineOverallJudgment([])).toBe("warning");
  });
});

describe("aggregateJudgments", () => {
  it("優先度 fail>warning>pass", () => {
    expect(aggregateJudgments(["pass", "warning", "fail"])).toBe("fail");
    expect(aggregateJudgments(["pass", "warning"])).toBe("warning");
    expect(aggregateJudgments(["pass", "pass"])).toBe("pass");
    expect(aggregateJudgments([])).toBe("warning");
  });
});
