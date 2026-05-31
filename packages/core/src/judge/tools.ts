import { z } from "zod";
import type { BrowserController } from "../browser/types.js";
import { readServerLogTail } from "../browser/server-log.js";
import type { LlmToolDef, LlmToolResultContent } from "./llm.js";

export const SUBMIT_JUDGMENT_TOOL = "submit_judgment";

export interface ToolContext {
  browser: BrowserController;
  /** capture_screenshot の保存先 */
  screenshotPath: string;
  /** get_server_log の対象。未設定なら空を返す。 */
  serverLogPath?: string;
}

export interface ToolOutcome {
  content: LlmToolResultContent[];
  isError?: boolean;
}

/** judge エージェントが使えるツール定義（submit_judgment を含む）。 */
export const JUDGE_TOOL_DEFS: LlmToolDef[] = [
  {
    name: "scroll_to_text",
    description:
      "指定テキストに一致する要素のうち最も下にあるものを画面内へスクロールする。チェックポイント対象が画面外と疑われる時に使う。",
    input_schema: {
      type: "object",
      properties: { text: { type: "string", description: "探す表示テキスト" } },
      required: ["text"],
    },
  },
  {
    name: "scroll_to_selector",
    description: "CSSセレクタに一致する要素を画面内へスクロールする。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "wait_for_selector",
    description:
      "要素が出現するまで待つ。まだ描画されていない（ロード中）と疑われる時に使う。出現すれば true。",
    input_schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        timeoutMs: { type: "number", description: "既定10000" },
      },
      required: ["selector"],
    },
  },
  {
    name: "capture_screenshot",
    description:
      "現在の画面を撮り直して返す。スクロール後や待機後に状態を再確認する時に使う。fullPage=true でページ全体を1枚に撮る。",
    input_schema: {
      type: "object",
      properties: { fullPage: { type: "boolean", description: "既定false" } },
    },
  },
  {
    name: "get_console_logs",
    description:
      "ブラウザのコンソールログ（error/warning含む）を取得する。未表示の原因がJSエラーか確認する時に使う。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_server_log",
    description:
      "サーバーログの末尾を取得する。クライアントに出ないサーバー側エラーを確認する時に使う。",
    input_schema: {
      type: "object",
      properties: { lines: { type: "number", description: "末尾行数。既定50" } },
    },
  },
  {
    name: "query_dom",
    description: "CSSセレクタの一致要素の有無・件数・先頭テキストを取得する。",
    input_schema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: SUBMIT_JUDGMENT_TOOL,
    description:
      "全チェックポイントの最終判定を提出して終了する。十分に確認できた時のみ呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        checkpoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              element: { type: "string" },
              judgment: { type: "string", enum: ["pass", "fail", "warning"] },
              reason: { type: "string" },
            },
            required: ["element", "judgment", "reason"],
          },
        },
      },
      required: ["checkpoints"],
    },
  },
];

const scrollToTextInput = z.object({ text: z.string() });
const scrollToSelectorInput = z.object({ selector: z.string() });
const waitForSelectorInput = z.object({
  selector: z.string(),
  timeoutMs: z.number().optional(),
});
const captureInput = z.object({ fullPage: z.boolean().optional() });
const serverLogInput = z.object({ lines: z.number().optional() });
const queryDomInput = z.object({ selector: z.string() });

function textOutcome(value: unknown): ToolOutcome {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function errorOutcome(message: string): ToolOutcome {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * ツールを実行し、tool_result 用のコンテンツを返す。
 * submit_judgment はエージェントが横取りするためここでは扱わない。
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "scroll_to_text": {
        const { text } = scrollToTextInput.parse(input);
        return textOutcome(await ctx.browser.scrollToText(text));
      }
      case "scroll_to_selector": {
        const { selector } = scrollToSelectorInput.parse(input);
        return textOutcome(await ctx.browser.scrollToSelector(selector));
      }
      case "wait_for_selector": {
        const { selector, timeoutMs } = waitForSelectorInput.parse(input);
        const ok = await ctx.browser.waitForSelector(selector, timeoutMs);
        return textOutcome({ selector, appeared: ok });
      }
      case "capture_screenshot": {
        const { fullPage } = captureInput.parse(input);
        const shot = await ctx.browser.screenshot({
          path: ctx.screenshotPath,
          fullPage: fullPage ?? false,
        });
        return {
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: shot.base64 },
            },
          ],
        };
      }
      case "get_console_logs": {
        return textOutcome(await ctx.browser.getConsoleLogs());
      }
      case "get_server_log": {
        const { lines } = serverLogInput.parse(input);
        if (!ctx.serverLogPath) return textOutcome({ serverLog: "(no server log path configured)" });
        const tail = await readServerLogTail(ctx.serverLogPath, lines ?? 50);
        return textOutcome({ serverLog: tail });
      }
      case "query_dom": {
        const { selector } = queryDomInput.parse(input);
        return textOutcome(await ctx.browser.queryDom(selector));
      }
      case SUBMIT_JUDGMENT_TOOL:
        return errorOutcome("submit_judgment is handled by the agent, not executeTool");
      default:
        return errorOutcome(`unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorOutcome(`tool '${name}' failed: ${message}`);
  }
}
