import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLogTail, readServerLogTail } from "../../src/browser/server-log.js";

describe("readLogTail (pure)", () => {
  it("末尾N行のみ返す", () => {
    const content = ["l1", "l2", "l3", "l4", "l5"].join("\n");
    expect(readLogTail(content, 2)).toBe("l4\nl5");
  });

  it("行数がNより少なければ全行返す", () => {
    expect(readLogTail("a\nb", 10)).toBe("a\nb");
  });

  it("N<=0 は空文字", () => {
    expect(readLogTail("a\nb", 0)).toBe("");
  });
});

describe("readServerLogTail (file)", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("ファイル末尾N行を読む", async () => {
    dir = mkdtempSync(join(tmpdir(), "vrt-log-"));
    const p = join(dir, "server.log");
    writeFileSync(p, "boot\nready\nGET /admin 200\nERROR boom\n");
    const tail = await readServerLogTail(p, 2);
    expect(tail).toContain("ERROR boom");
    expect(tail).not.toContain("boot");
  });

  it("存在しないファイルは空文字（落とさない）", async () => {
    expect(await readServerLogTail("/no/such/file.log", 5)).toBe("");
  });
});
