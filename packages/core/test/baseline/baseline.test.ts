import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaselineStore } from "../../src/baseline/baseline.js";

describe("BaselineStore", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("保存したベースラインを取得でき、未登録は null", async () => {
    dir = mkdtempSync(join(tmpdir(), "vrt-baseline-"));
    const srcPng = join(dir, "src.png");
    writeFileSync(srcPng, "fakepng");
    const store = new BaselineStore(join(dir, "baselines"));

    expect(await store.getBaselinePath("管理", "step1")).toBeNull();

    const saved = await store.saveBaseline("管理", "step1", srcPng);
    expect(saved).toContain(".png");

    const got = await store.getBaselinePath("管理", "step1");
    expect(got).not.toBeNull();
    expect(got).toBe(saved);
    expect(await store.getBaselinePath("管理", "other")).toBeNull();
  });
});
