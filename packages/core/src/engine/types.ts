import type { CheckpointResult, JudgmentResult } from "../contracts.js";

export interface StepResult {
  stepId: string;
  intent: string;
  checkpoints: CheckpointResult[];
  overall: JudgmentResult;
  screenshotPath: string | null;
  executedAt: string;
}

export interface ScenarioResult {
  scenario: string;
  priority: string;
  steps: StepResult[];
  overall: JudgmentResult;
  durationMs: number;
  executedAt: string;
}

export interface ReportSummary {
  total: number;
  pass: number;
  fail: number;
  warn: number;
}

export interface RegressionReport {
  reportId: string;
  generatedAt: string;
  results: ScenarioResult[];
  summary: ReportSummary;
  overall: JudgmentResult;
}
