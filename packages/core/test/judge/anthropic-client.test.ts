import { describe, it, expect, vi } from "vitest";
import {
  AnthropicLlmClient,
  type AnthropicCreateParams,
  type RawAnthropicResponse,
} from "../../src/judge/anthropic-client.js";

describe("AnthropicLlmClient (mapping)", () => {
  it("リクエストをモデル/トークン/ツール込みで組み立て、レスポンスをLlmResponseへ写す", async () => {
    const create = vi.fn(
      async (_p: AnthropicCreateParams): Promise<RawAnthropicResponse> => ({
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "考え中" },
          { type: "tool_use", id: "t1", name: "scroll_to_text", input: { text: "MRR推移" } },
          { type: "unsupported_block", foo: 1 },
        ],
      }),
    );
    const client = new AnthropicLlmClient(create, "claude-sonnet-4-6", 1234);

    const out = await client.createMessage({
      system: "sys",
      tools: [{ name: "scroll_to_text", description: "d", input_schema: { type: "object" } }],
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    });

    // リクエストマッピング
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-sonnet-4-6");
    expect(params.max_tokens).toBe(1234);
    expect(params.tools[0]!.name).toBe("scroll_to_text");

    // レスポンスマッピング: text と tool_use のみ拾い、未知ブロックは捨てる
    expect(out.stopReason).toBe("tool_use");
    expect(out.content).toEqual([
      { type: "text", text: "考え中" },
      { type: "tool_use", id: "t1", name: "scroll_to_text", input: { text: "MRR推移" } },
    ]);
  });

  it("req.maxTokens があれば優先する / stop_reason null は end_turn 扱い", async () => {
    const create = vi.fn(
      async (_p: AnthropicCreateParams): Promise<RawAnthropicResponse> => ({
        stop_reason: null,
        content: [{ type: "text", text: "done" }],
      }),
    );
    const client = new AnthropicLlmClient(create, "m", 2000);
    const out = await client.createMessage({
      system: "s",
      tools: [],
      messages: [],
      maxTokens: 500,
    });
    expect(create.mock.calls[0]![0].max_tokens).toBe(500);
    expect(out.stopReason).toBe("end_turn");
  });
});
