import { z } from "zod";
import { parse as parseYaml } from "yaml";

export const checkpointSchema = z.object({
  element: z.string().min(1),
  expect: z.string().min(1),
});

/**
 * セットアップ用の相互作用。判定そのものではなく「判定前の状態作り」に使う。
 * 旧VRTの scroll_to/wait_after_ms ハードコードは廃し、探索は judge エージェントに委ねる。
 * ここに残すのは決定論的に必要な操作（ログイン後の遷移・フォーム入力等）のみ。
 */
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), selector: z.string() }),
  z.object({ type: z.literal("fill"), selector: z.string(), value: z.string() }),
  z.object({ type: z.literal("wait_for"), selector: z.string(), timeoutMs: z.number().optional() }),
  z.object({ type: z.literal("scroll_to_text"), text: z.string() }),
  z.object({ type: z.literal("scroll_to_selector"), selector: z.string() }),
]);

export const stepSchema = z.object({
  id: z.string().min(1),
  /** このステップで確認したい意図（自然文・judge へ渡す） */
  intent: z.string().min(1),
  /** 遷移先（絶対URL or baseUrl 相対パス）。省略時は現在ページ */
  navigate: z.string().optional(),
  /** 判定前のセットアップ操作 */
  actions: z.array(actionSchema).optional(),
  checkpoints: z.array(checkpointSchema).min(1),
});

export const scenarioSchema = z.object({
  scenario: z.string().min(1),
  priority: z.enum(["critical", "high", "medium", "low"]),
  description: z.string().optional(),
  preconditions: z
    .object({ baseUrl: z.string().optional() })
    .optional(),
  steps: z.array(stepSchema).min(1),
});

export type StepAction = z.infer<typeof actionSchema>;
export type ScenarioStep = z.infer<typeof stepSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

/** YAML 文字列を検証付きで Scenario に変換。 */
export function parseScenario(yamlText: string): Scenario {
  const raw: unknown = parseYaml(yamlText);
  return scenarioSchema.parse(raw);
}
