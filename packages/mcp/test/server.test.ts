import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createVrtMcpServer } from "../src/server.js";
import type { BrowserController, Judge } from "@taylormode-lab/agentic-vrt-core";

describe("createVrtMcpServer", () => {
  it("McpServer を生成し verify_page ツールを登録できる（throwしない）", () => {
    const deps = {
      createBrowser: async (): Promise<BrowserController> => {
        throw new Error("not used in this smoke test");
      },
      createJudge: (): Judge => ({ judge: async () => [] }),
      screenshotPath: "/tmp/s.png",
    };
    const server = createVrtMcpServer(deps);
    expect(server).toBeInstanceOf(McpServer);
  });
});
