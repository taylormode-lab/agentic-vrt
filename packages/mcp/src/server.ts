import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runVerify, type VerifyDeps } from "./verify.js";
import { formatVerifyResult } from "./format.js";

/**
 * Agentic VRT のローカル stdio MCP サーバーを構築する。
 * 公開ツール verify_page: URL と意図・チェックポイントを受け、自律判定して結果を返す。
 */
export function createVrtMcpServer(deps: VerifyDeps): McpServer {
  const server = new McpServer({ name: "agentic-vrt", version: "0.1.0" });

  server.registerTool(
    "verify_page",
    {
      title: "Verify a page with an autonomous visual judge",
      description:
        "指定URLを開き、自律エージェントがスクロール/待機/ログ確認などで探索しながら、意図とチェックポイントに対し pass/fail/warning を根拠付きで判定する。",
      inputSchema: {
        url: z.string().describe("検証対象のURL（ローカル開発サーバ等）"),
        intent: z.string().describe("このページで確認したい意図（自然文）"),
        checkpoints: z
          .array(
            z.object({
              element: z.string().describe("観点名"),
              expect: z.string().describe("期待状態"),
            }),
          )
          .min(1),
      },
    },
    async (args) => {
      const results = await runVerify(
        { url: args.url, intent: args.intent, checkpoints: args.checkpoints },
        deps,
      );
      const formatted = formatVerifyResult(results);
      return { content: formatted.content, isError: formatted.isError };
    },
  );

  return server;
}
