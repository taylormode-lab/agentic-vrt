import { describe, it, expect, vi } from "vitest";
import type {
  BrowserController,
  Checkpoint,
  CheckpointResult,
  Judge,
} from "@taylormode-lab/agentic-vrt-core";
import { runVerify } from "../src/verify.js";

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

const passJudge: Judge = {
  judge: async (input: { intent: string; checkpoints: Checkpoint[] }): Promise<CheckpointResult[]> =>
    input.checkpoints.map((c) => ({ element: c.element, expect: c.expect, judgment: "pass", reason: "ok" })),
};

describe("runVerify", () => {
  it("navigate→judge を実行し browser を必ず close する", async () => {
    const browser = makeBrowser();
    const out = await runVerify(
      { url: "http://localhost:3333/admin", intent: "確認", checkpoints: [{ element: "E", expect: "x" }] },
      { createBrowser: async () => browser, createJudge: () => passJudge, screenshotPath: "/tmp/s.png" },
    );
    expect(browser.navigate).toHaveBeenCalledWith("http://localhost:3333/admin");
    expect(out[0]!.judgment).toBe("pass");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("judge が例外でも browser を close する", async () => {
    const browser = makeBrowser();
    const boom: Judge = { judge: async () => { throw new Error("boom"); } };
    await expect(
      runVerify(
        { url: "http://x", intent: "i", checkpoints: [{ element: "E", expect: "x" }] },
        { createBrowser: async () => browser, createJudge: () => boom, screenshotPath: "/tmp/s.png" },
      ),
    ).rejects.toThrow("boom");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
