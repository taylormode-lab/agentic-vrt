import { describe, it, expect } from "vitest";
import type { CheckpointResult } from "@taylormode-lab/agentic-vrt-core";
import { formatVerifyResult } from "../src/format.js";

const cp = (judgment: CheckpointResult["judgment"]): CheckpointResult => ({
  element: "E",
  expect: "x",
  judgment,
  reason: "r",
});

describe("formatVerifyResult", () => {
  it("fail が含まれると isError=true、本文に overall を含む", () => {
    const out = formatVerifyResult([cp("pass"), cp("fail")]);
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toContain('"overall": "fail"');
  });

  it("全 pass は isError=false", () => {
    const out = formatVerifyResult([cp("pass")]);
    expect(out.isError).toBe(false);
    expect(out.content[0]!.text).toContain('"overall": "pass"');
  });
});
