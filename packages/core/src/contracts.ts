export type JudgmentResult = "pass" | "fail" | "warning";

/** 検証したい1観点。「何が見えていてほしいか」を意図ベースで書く。 */
export interface Checkpoint {
  /** 観点の短い名前（例: "MRR推移チャート"） */
  element: string;
  /** 期待状態（例: "MRR推移の折れ線グラフが描画されている"） */
  expect: string;
}

export interface CheckpointResult {
  element: string;
  expect: string;
  judgment: JudgmentResult;
  reason: string;
}
