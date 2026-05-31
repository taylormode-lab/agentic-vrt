import { z } from "zod";
import type { BrowserController } from "../browser/types.js";
import type { Checkpoint, CheckpointResult, JudgmentResult } from "../contracts.js";
import type {
  LlmAssistantBlock,
  LlmClient,
  LlmMessage,
  LlmToolResultBlock,
  LlmToolUseBlock,
  LlmUserBlock,
} from "./llm.js";
import {
  executeTool,
  JUDGE_TOOL_DEFS,
  SUBMIT_JUDGMENT_TOOL,
  type ToolContext,
} from "./tools.js";

export interface JudgeConfig {
  /** submit_judgment に至らない場合の最大反復数（無限ループ防止）。既定8。 */
  maxIterations?: number;
  /** get_server_log の対象パス */
  serverLogPath?: string;
  /** capture_screenshot の保存先。既定はOS一時ファイル運用側で指定。 */
  screenshotPath: string;
}

export interface JudgeInput {
  /** このステップで確認したい意図（自然文） */
  intent: string;
  checkpoints: Checkpoint[];
  /** 初期スクリーンショットの base64。未指定なら browser から撮る。 */
  initialScreenshotBase64?: string;
}

export interface JudgeDeps {
  llm: LlmClient;
  browser: BrowserController;
  config: JudgeConfig;
}

const submitSchema = z.object({
  checkpoints: z.array(
    z.object({
      element: z.string(),
      judgment: z.enum(["pass", "fail", "warning"]),
      reason: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `あなたはWebアプリの回帰テストを行う自律エージェントです。
人間のテスターのように振る舞ってください:
- 確認対象が画面に見えない場合は、scroll_to_text / scroll_to_selector で自分でスクロールして探す。
- まだ描画されていない（ロード中）と疑われる場合は wait_for_selector で待ってから capture_screenshot で撮り直す。
- それでも見えない場合は get_console_logs / get_server_log でエラーを確認し、原因を判断する。
- 推測で判定しない。スクリーンショットやDOM/ログの事実に基づいて判断する。
- 十分に確認できたら submit_judgment を1回だけ呼んで全チェックポイントの最終判定（pass/fail/warning）と根拠を提出する。
判定基準: pass=期待通り確認できた / fail=期待と異なる・エラー・未表示 / warning=確認できるが懸念がある。`;

function buildInitialUserMessage(
  input: JudgeInput,
  screenshotBase64: string,
): LlmMessage {
  const checkpointList = input.checkpoints
    .map((c, i) => `${i + 1}. ${c.element} → 期待: ${c.expect}`)
    .join("\n");
  const content: LlmUserBlock[] = [
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: screenshotBase64 },
    },
    {
      type: "text",
      text: `## 検証意図\n${input.intent}\n\n## チェックポイント\n${checkpointList}\n\n上記を確認し、必要ならツールで探索してから submit_judgment を呼んでください。`,
    },
  ];
  return { role: "user", content };
}

function fallbackResults(checkpoints: Checkpoint[], reason: string): CheckpointResult[] {
  return checkpoints.map((c) => ({
    element: c.element,
    expect: c.expect,
    judgment: "warning" as JudgmentResult,
    reason,
  }));
}

function parseSubmission(
  input: Record<string, unknown>,
  checkpoints: Checkpoint[],
): CheckpointResult[] {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return fallbackResults(checkpoints, `submit_judgment の形式不正: ${parsed.error.message}`);
  }
  const byElement = new Map(parsed.data.checkpoints.map((c) => [c.element, c]));
  return checkpoints.map((c) => {
    const found = byElement.get(c.element);
    if (found) {
      return { element: c.element, expect: c.expect, judgment: found.judgment, reason: found.reason };
    }
    return {
      element: c.element,
      expect: c.expect,
      judgment: "warning" as JudgmentResult,
      reason: "LLMが該当チェックポイントの判定を返さなかった",
    };
  });
}

/**
 * tool-use ループで自律的に画面を探索し、根拠付きで判定する VRT 判定エージェント。
 */
export class JudgeAgent {
  private readonly llm: LlmClient;
  private readonly browser: BrowserController;
  private readonly config: JudgeConfig;

  constructor(deps: JudgeDeps) {
    this.llm = deps.llm;
    this.browser = deps.browser;
    this.config = deps.config;
  }

  async judge(input: JudgeInput): Promise<CheckpointResult[]> {
    const maxIterations = this.config.maxIterations ?? 8;
    const toolCtx: ToolContext = {
      browser: this.browser,
      screenshotPath: this.config.screenshotPath,
      ...(this.config.serverLogPath !== undefined
        ? { serverLogPath: this.config.serverLogPath }
        : {}),
    };

    let screenshotBase64 = input.initialScreenshotBase64;
    if (!screenshotBase64) {
      const shot = await this.browser.screenshot({
        path: this.config.screenshotPath,
        fullPage: false,
      });
      screenshotBase64 = shot.base64;
    }

    const messages: LlmMessage[] = [buildInitialUserMessage(input, screenshotBase64)];

    for (let i = 0; i < maxIterations; i++) {
      const res = await this.llm.createMessage({
        system: SYSTEM_PROMPT,
        tools: JUDGE_TOOL_DEFS,
        messages,
      });
      messages.push({ role: "assistant", content: res.content });

      const toolUses = res.content.filter(
        (b): b is LlmToolUseBlock => b.type === "tool_use",
      );

      if (toolUses.length === 0) {
        // ツールを使わず終了した場合はフォールバック
        return fallbackResults(
          input.checkpoints,
          "LLMがsubmit_judgmentを呼ばずに終了した",
        );
      }

      const submit = toolUses.find((t) => t.name === SUBMIT_JUDGMENT_TOOL);
      if (submit) {
        return parseSubmission(submit.input, input.checkpoints);
      }

      const resultBlocks: LlmToolResultBlock[] = [];
      for (const toolUse of toolUses) {
        const outcome = await executeTool(toolUse.name, toolUse.input, toolCtx);
        resultBlocks.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: outcome.content,
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: resultBlocks });
    }

    return fallbackResults(
      input.checkpoints,
      `最大反復(${maxIterations})に達したが判定が確定しなかった`,
    );
  }
}

export type { LlmAssistantBlock };
