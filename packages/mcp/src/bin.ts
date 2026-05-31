#!/usr/bin/env node
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  JudgeAgent,
  PuppeteerBrowserController,
  createAnthropicLlmClient,
  type BrowserController,
} from "@taylormode-lab/agentic-vrt-core";
import { createVrtMcpServer } from "./server.js";

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  const model = process.env.VRT_MODEL ?? "claude-sonnet-4-6";

  const server = createVrtMcpServer({
    createBrowser: async (): Promise<BrowserController> => {
      const browser = new PuppeteerBrowserController();
      await browser.launch();
      return browser;
    },
    createJudge: ({ browser, screenshotPath }) =>
      new JudgeAgent({
        llm: createAnthropicLlmClient({ apiKey, model }),
        browser,
        config: { screenshotPath },
      }),
    screenshotPath: join(tmpdir(), "agentic-vrt-mcp.png"),
  });

  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
