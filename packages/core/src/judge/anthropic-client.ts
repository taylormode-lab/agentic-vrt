import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmAssistantBlock,
  LlmClient,
  LlmRequest,
  LlmResponse,
} from "./llm.js";

/** Anthropic Messages API レスポンスの最小形（マッピングに必要な部分のみ）。 */
export interface RawAnthropicResponse {
  stop_reason: string | null;
  content: Array<{ type: string; [key: string]: unknown }>;
}

export interface AnthropicCreateParams {
  model: string;
  max_tokens: number;
  system: string;
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
}

export type AnthropicCreateFn = (
  params: AnthropicCreateParams,
) => Promise<RawAnthropicResponse>;

/**
 * LlmClient の Anthropic 実装。
 * create 関数を注入できるため、SDK 非依存でマッピングをユニットテストできる。
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly create: AnthropicCreateFn;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(create: AnthropicCreateFn, model: string, maxTokens = 2000) {
    this.create = create;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    const raw = await this.create({
      model: this.model,
      max_tokens: req.maxTokens ?? this.maxTokens,
      system: req.system,
      tools: req.tools,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const content: LlmAssistantBlock[] = [];
    for (const block of raw.content) {
      if (block.type === "text" && typeof block.text === "string") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        const id = typeof block.id === "string" ? block.id : "";
        const name = typeof block.name === "string" ? block.name : "";
        const input =
          block.input && typeof block.input === "object"
            ? (block.input as Record<string, unknown>)
            : {};
        content.push({ type: "tool_use", id, name, input });
      }
    }

    return { stopReason: raw.stop_reason ?? "end_turn", content };
  }
}

/** 実 SDK を使う本番用ファクトリ。 */
export function createAnthropicLlmClient(opts: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}): AnthropicLlmClient {
  const client = new Anthropic({ apiKey: opts.apiKey });
  // SDK の create は厳密なユニオン型を要求するため、アダプタ境界で型を橋渡しする。
  const create: AnthropicCreateFn = (params) =>
    client.messages.create(
      params as unknown as Parameters<typeof client.messages.create>[0],
    ) as unknown as Promise<RawAnthropicResponse>;
  return new AnthropicLlmClient(create, opts.model ?? "claude-sonnet-4-6", opts.maxTokens);
}
