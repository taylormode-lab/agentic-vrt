/**
 * Anthropic Messages API（tool use）に互換な最小型。
 * 実クライアントは薄いアダプタ、テストはモックで差し替える。
 */
export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmTextBlock {
  type: "text";
  text: string;
}

export interface LlmImageSource {
  type: "base64";
  media_type: "image/png";
  data: string;
}

export interface LlmImageBlock {
  type: "image";
  source: LlmImageSource;
}

export interface LlmToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type LlmToolResultContent = LlmTextBlock | LlmImageBlock;

export interface LlmToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: LlmToolResultContent[];
  is_error?: boolean;
}

export type LlmAssistantBlock = LlmTextBlock | LlmToolUseBlock;
export type LlmUserBlock = LlmTextBlock | LlmImageBlock | LlmToolResultBlock;

export interface LlmMessage {
  role: "user" | "assistant";
  content: LlmUserBlock[] | LlmAssistantBlock[];
}

export interface LlmRequest {
  system: string;
  tools: LlmToolDef[];
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmResponse {
  stopReason: string;
  content: LlmAssistantBlock[];
}

export interface LlmClient {
  createMessage(req: LlmRequest): Promise<LlmResponse>;
}
