import { aggregateJudgments } from "../engine/judgment.js";
import type {
  RegressionReport,
  ReportSummary,
  ScenarioResult,
} from "../engine/types.js";

export function summarize(results: ScenarioResult[]): ReportSummary {
  return {
    total: results.length,
    pass: results.filter((r) => r.overall === "pass").length,
    fail: results.filter((r) => r.overall === "fail").length,
    warn: results.filter((r) => r.overall === "warning").length,
  };
}

export function buildReport(
  results: ScenarioResult[],
  opts?: { reportId?: string; generatedAt?: string },
): RegressionReport {
  return {
    reportId: opts?.reportId ?? `report-${Date.now()}`,
    generatedAt: opts?.generatedAt ?? new Date().toISOString(),
    results,
    summary: summarize(results),
    overall: aggregateJudgments(results.map((r) => r.overall)),
  };
}

const ICON: Record<string, string> = { pass: "PASS", fail: "FAIL", warning: "WARN" };

export function toMarkdown(report: RegressionReport): string {
  const lines: string[] = [];
  lines.push(`# Agentic VRT Report`);
  lines.push("");
  lines.push(`- reportId: ${report.reportId}`);
  lines.push(`- generatedAt: ${report.generatedAt}`);
  lines.push(
    `- summary: total=${report.summary.total} pass=${report.summary.pass} fail=${report.summary.fail} warn=${report.summary.warn}`,
  );
  lines.push(`- overall: ${ICON[report.overall] ?? report.overall}`);
  lines.push("");
  for (const sc of report.results) {
    lines.push(`## [${ICON[sc.overall] ?? sc.overall}] ${sc.scenario} (${sc.priority})`);
    for (const step of sc.steps) {
      lines.push(`- ${ICON[step.overall] ?? step.overall} **${step.stepId}** — ${step.intent}`);
      for (const cp of step.checkpoints) {
        lines.push(`  - [${ICON[cp.judgment] ?? cp.judgment}] ${cp.element}: ${cp.reason}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
