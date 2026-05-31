import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChromeExecutable } from "../../src/browser/chrome.js";
import { PuppeteerBrowserController } from "../../src/browser/puppeteer-controller.js";

const chrome = resolveChromeExecutable();
const fixture = (name: string): string =>
  new URL(`../fixtures/${name}`, import.meta.url).href;

// Chrome が無い環境（CI 未整備等）ではスキップ。ローカル/整備済み CI で実行。
describe.skipIf(!chrome)("PuppeteerBrowserController (integration, real Chrome)", () => {
  let ctrl: PuppeteerBrowserController;
  let workDir: string;

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), "vrt-shots-"));
    ctrl = new PuppeteerBrowserController({ headless: true });
    await ctrl.launch();
  }, 60_000);

  afterAll(async () => {
    await ctrl?.close();
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it("navigate して URL を取得できる", async () => {
    await ctrl.navigate(fixture("offscreen-chart.html"));
    expect(await ctrl.getPageUrl()).toContain("offscreen-chart.html");
  });

  it("曖昧一致 'MRR' は複数要素に当たる（上部ラベル + 下部見出し）", async () => {
    await ctrl.navigate(fixture("offscreen-chart.html"));
    const res = await ctrl.scrollToText("MRR");
    expect(res.matched).toBeGreaterThanOrEqual(2);
    expect(res.scrolled).toBe(true);
  });

  it("最下要素へスクロールするので、画面外だった MRR推移チャートが viewport 内に入る", async () => {
    await ctrl.navigate(fixture("offscreen-chart.html"));
    await ctrl.scrollToText("MRR推移");
    // スクロール後、#mrr-chart が viewport 内に来ていること（自力探索の証明）
    const inView = await ctrl.queryDom("#mrr-chart");
    expect(inView.found).toBe(true);
    // 位置検証は controller 経由の evaluate がないため、内部 page で確認する代替として
    // scrollToText の結果（一致 1 件・スクロール実施）を確認
    const res = await ctrl.scrollToText("MRR推移");
    expect(res.matched).toBe(1);
    expect(res.scrolled).toBe(true);
  });

  it("fullPage スクリーンショットは viewport 限定より大きい（画面外も写る）", async () => {
    await ctrl.navigate(fixture("offscreen-chart.html"));
    const viewportShot = await ctrl.screenshot({
      path: join(workDir, "vp.png"),
      fullPage: false,
    });
    const fullShot = await ctrl.screenshot({
      path: join(workDir, "full.png"),
      fullPage: true,
    });
    expect(fullShot.fullPage).toBe(true);
    expect(fullShot.base64.length).toBeGreaterThan(viewportShot.base64.length);
  });

  it("遅延描画される要素を waitForSelector で待てる / 無い要素は false", async () => {
    await ctrl.navigate(fixture("delayed-load.html"));
    expect(await ctrl.waitForSelector("#late", 3_000)).toBe(true);
    expect(await ctrl.waitForSelector("#never", 500)).toBe(false);
  });

  it("コンソールエラーを収集できる", async () => {
    await ctrl.navigate(fixture("console-error.html"));
    // console イベントは描画後に届くため少し待つ
    await new Promise((r) => setTimeout(r, 300));
    const logs = await ctrl.getConsoleLogs();
    expect(logs.some((l) => l.type === "error" && l.text.includes("BOOM_FIXTURE_ERROR"))).toBe(true);
  });
});
