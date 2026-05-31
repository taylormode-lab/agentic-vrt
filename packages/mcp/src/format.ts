import { determineOverallJudgment, type CheckpointResult } from "@taylormode-lab/agentic-vrt-core";

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
}

/**
 * 判定結果を MCP のツール結果へ整形する。
 * 総合が fail のとき isError=true（呼び出し側エージェントが失敗を識別できる）。
 */
export function formatVerifyResult(results: CheckpointResult[]): McpToolResult {
  const overall = determineOverallJudgment(results);
  const text = JSON.stringify({ overall, checkpoints: results }, null, 2);
  return {
    content: [{ type: "text", text }],
    isError: overall === "fail",
  };
}
