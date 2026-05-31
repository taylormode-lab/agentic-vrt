import type { CheckpointResult, JudgmentResult } from "../contracts.js";

/**
 * チェックポイント結果群から総合判定を決める。
 * 優先度: fail > warning > pass。空（判定なし）は warning（未検証は不審）。
 */
export function determineOverallJudgment(results: CheckpointResult[]): JudgmentResult {
  if (results.length === 0) return "warning";
  if (results.some((r) => r.judgment === "fail")) return "fail";
  if (results.some((r) => r.judgment === "warning")) return "warning";
  return "pass";
}

/** 既に算出済みの個別判定群から総合を決める（ステップ→シナリオ集約用）。 */
export function aggregateJudgments(judgments: JudgmentResult[]): JudgmentResult {
  if (judgments.length === 0) return "warning";
  if (judgments.includes("fail")) return "fail";
  if (judgments.includes("warning")) return "warning";
  return "pass";
}
