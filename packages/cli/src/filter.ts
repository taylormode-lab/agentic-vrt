import type { Scenario } from "@taylormode-lab/agentic-vrt-core";

/**
 * シナリオ名の部分一致、または priority 完全一致でフィルタする。
 * filter 未指定なら全件。
 */
export function filterScenarios(scenarios: Scenario[], filter?: string): Scenario[] {
  if (!filter) return scenarios;
  return scenarios.filter(
    (s) => s.scenario.includes(filter) || s.priority === filter,
  );
}
