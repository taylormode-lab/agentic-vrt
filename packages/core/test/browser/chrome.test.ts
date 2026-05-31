import { describe, it, expect } from "vitest";
import { resolveChromeExecutable } from "../../src/browser/chrome.js";

describe("resolveChromeExecutable", () => {
  it("PUPPETEER_EXECUTABLE_PATH を最優先で返す", () => {
    const got = resolveChromeExecutable({ PUPPETEER_EXECUTABLE_PATH: "/custom/chrome" }, "darwin");
    expect(got).toBe("/custom/chrome");
  });

  it("CHROME_PATH を次に優先する", () => {
    const got = resolveChromeExecutable({ CHROME_PATH: "/c/chrome" }, "linux");
    expect(got).toBe("/c/chrome");
  });

  it("未知のプラットフォームかつ env 指定なしなら null", () => {
    const got = resolveChromeExecutable({}, "sunos");
    expect(got).toBeNull();
  });
});
