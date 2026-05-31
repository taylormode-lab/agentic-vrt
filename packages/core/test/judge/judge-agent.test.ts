import { describe, it, expect, vi } from "vitest";
import type { BrowserController } from "../../src/browser/types.js";
import type {
  LlmAssistantBlock,
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmToolUseBlock,
} from "../../src/judge/llm.js";
import { JudgeAgent } from "../../src/judge/judge-agent.js";
import { SUBMIT_JUDGMENT_TOOL } from "../../src/judge/tools.js";
import type { Checkpoint } from "../../src/contracts.js";

function toolUse(name: string, input: Record<string, unknown>, id: string): LlmToolUseBlock {
  return { type: "tool_use", id, name, input };
}

function submit(
  results: Array<{ element: string; judgment: string; reason: string }>,
  id = "submit-1",
): LlmAssistantBlock {
  return toolUse(SUBMIT_JUDGMENT_TOOL, { checkpoints: results }, id);
}

function res(content: LlmAssistantBlock[]): LlmResponse {
  return { stopReason: "tool_use", content };
}

class ScriptedLlm implements LlmClient {
  public calls: LlmRequest[] = [];
  constructor(private responses: LlmResponse[]) {}
  createMessage = async (req: LlmRequest): Promise<LlmResponse> => {
    this.calls.push(req);
    const next = this.responses.shift();
    if (!next) throw new Error("ScriptedLlm: no response left");
    return next;
  };
}

function makeBrowser(): BrowserController {
  return {
    navigate: vi.fn(async () => {}),
    waitForSelector: vi.fn(async () => true),
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    scrollToText: vi.fn(async () => ({ matched: 2, strategy: "text" as const, scrolled: true })),
    scrollToSelector: vi.fn(async () => ({ matched: 1, strategy: "selector" as const, scrolled: true })),
    screenshot: vi.fn(async (o: { path: string; fullPage?: boolean }) => ({
      path: o.path,
      base64: "BASE64DATA",
      fullPage: o.fullPage ?? false,
    })),
    getConsoleLogs: vi.fn(async () => [{ type: "error" as const, text: "BOOM_ERROR" }]),
    queryDom: vi.fn(async () => ({ found: true, text: "x", count: 1 })),
    getPageContent: vi.fn(async () => "content"),
    getPageUrl: vi.fn(async () => "http://localhost/x"),
    close: vi.fn(async () => {}),
  };
}

const checkpoints: Checkpoint[] = [
  { element: "MRR推移チャート", expect: "MRR推移の折れ線グラフが描画されている" },
];

const baseConfig = { screenshotPath: "/tmp/vrt-shot.png" };

describe("JudgeAgent", () => {
  it("即submitなら追加のブラウザ操作なしで判定を返す", async () => {
    const llm = new ScriptedLlm([
      res([submit([{ element: "MRR推移チャート", judgment: "pass", reason: "描画確認" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    const out = await agent.judge({ intent: "MRR推移を確認", checkpoints });

    expect(out).toEqual([
      { element: "MRR推移チャート", expect: checkpoints[0]!.expect, judgment: "pass", reason: "描画確認" },
    ]);
    expect(llm.calls).toHaveLength(1);
    expect(browser.scrollToText).not.toHaveBeenCalled();
    // 初期スクショ1回のみ
    expect(browser.screenshot).toHaveBeenCalledTimes(1);
  });

  it("見えない時はscroll→再撮影してから判定する（自力探索）", async () => {
    const llm = new ScriptedLlm([
      res([toolUse("scroll_to_text", { text: "MRR推移" }, "t1")]),
      res([toolUse("capture_screenshot", { fullPage: false }, "t2")]),
      res([submit([{ element: "MRR推移チャート", judgment: "pass", reason: "スクロール後に確認" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    const out = await agent.judge({ intent: "MRR推移を確認", checkpoints });

    expect(out[0]!.judgment).toBe("pass");
    expect(browser.scrollToText).toHaveBeenCalledWith("MRR推移");
    // 初期 + capture_screenshot = 2 回
    expect(browser.screenshot).toHaveBeenCalledTimes(2);
    expect(llm.calls).toHaveLength(3);
  });

  it("コンソールログを根拠にfail判定できる", async () => {
    const llm = new ScriptedLlm([
      res([toolUse("get_console_logs", {}, "c1")]),
      res([submit([{ element: "MRR推移チャート", judgment: "fail", reason: "JSエラーで未描画" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    const out = await agent.judge({ intent: "MRR推移を確認", checkpoints });

    expect(browser.getConsoleLogs).toHaveBeenCalledTimes(1);
    expect(out[0]!.judgment).toBe("fail");
  });

  it("未知ツールでも落ちずに継続し、最終的に判定できる", async () => {
    const llm = new ScriptedLlm([
      res([toolUse("frobnicate", { foo: 1 }, "u1")]),
      res([submit([{ element: "MRR推移チャート", judgment: "warning", reason: "確認継続" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    const out = await agent.judge({ intent: "MRR推移を確認", checkpoints });
    expect(out[0]!.judgment).toBe("warning");
    expect(llm.calls).toHaveLength(2);
  });

  it("submitに含まれないチェックポイントはwarningで補完される", async () => {
    const multi: Checkpoint[] = [
      { element: "A", expect: "aが見える" },
      { element: "B", expect: "bが見える" },
    ];
    const llm = new ScriptedLlm([
      res([submit([{ element: "A", judgment: "pass", reason: "ok" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    const out = await agent.judge({ intent: "確認", checkpoints: multi });
    expect(out.find((r) => r.element === "A")!.judgment).toBe("pass");
    expect(out.find((r) => r.element === "B")!.judgment).toBe("warning");
  });

  it("submitに至らない場合は最大反復で打ち切りwarningを返す（無限ループ防止）", async () => {
    const llm = new ScriptedLlm([
      res([toolUse("scroll_to_text", { text: "x" }, "1")]),
      res([toolUse("scroll_to_text", { text: "x" }, "2")]),
      res([toolUse("scroll_to_text", { text: "x" }, "3")]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: { ...baseConfig, maxIterations: 3 } });

    const out = await agent.judge({ intent: "確認", checkpoints });
    expect(out[0]!.judgment).toBe("warning");
    expect(out[0]!.reason).toContain("最大反復");
    expect(browser.scrollToText).toHaveBeenCalledTimes(3);
    expect(llm.calls).toHaveLength(3);
  });

  it("initialScreenshotBase64を渡せば初期スクショを撮らない", async () => {
    const llm = new ScriptedLlm([
      res([submit([{ element: "MRR推移チャート", judgment: "pass", reason: "ok" }])]),
    ]);
    const browser = makeBrowser();
    const agent = new JudgeAgent({ llm, browser, config: baseConfig });

    await agent.judge({ intent: "確認", checkpoints, initialScreenshotBase64: "PRESET" });
    expect(browser.screenshot).not.toHaveBeenCalled();
  });
});
