import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import puppeteer from "puppeteer-core";
import type { Browser, Page, ConsoleMessage } from "puppeteer-core";
import { resolveChromeExecutable } from "./chrome.js";
import type {
  BrowserController,
  ConsoleLogEntry,
  DomQueryResult,
  ScreenshotOptions,
  ScreenshotResult,
  ScrollResult,
} from "./types.js";

export interface PuppeteerControllerOptions {
  executablePath?: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  args?: string[];
}

export class ChromeNotFoundError extends Error {
  constructor() {
    super(
      "Chrome/Chromium executable not found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.",
    );
    this.name = "ChromeNotFoundError";
  }
}

/**
 * puppeteer-core によるローカル Chrome 実装。
 * judge エージェントへ渡すブラウザ操作ツールの実体。
 */
export class PuppeteerBrowserController implements BrowserController {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleLogs: ConsoleLogEntry[] = [];
  private readonly options: PuppeteerControllerOptions;

  constructor(options: PuppeteerControllerOptions = {}) {
    this.options = options;
  }

  async launch(): Promise<void> {
    const executablePath =
      this.options.executablePath ?? resolveChromeExecutable() ?? undefined;
    if (!executablePath) throw new ChromeNotFoundError();

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.options.headless ?? true,
      args: this.options.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
    const viewport = this.options.viewport ?? { width: 1920, height: 1080 };
    await this.page.setViewport({ ...viewport, deviceScaleFactor: 1 });

    this.page.on("console", (msg: ConsoleMessage) => {
      const raw = String(msg.type());
      const type: ConsoleLogEntry["type"] =
        raw === "error"
          ? "error"
          : raw === "warning" || raw === "warn"
            ? "warning"
            : raw === "info"
              ? "info"
              : raw === "debug" || raw === "verbose"
                ? "debug"
                : "log";
      this.consoleLogs.push({ type, text: msg.text() });
    });
    this.page.on("pageerror", (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.consoleLogs.push({ type: "error", text: message });
    });
  }

  private ensurePage(): Page {
    if (!this.page) {
      throw new Error("Browser not launched. Call launch() first.");
    }
    return this.page;
  }

  async navigate(
    url: string,
    opts?: { waitUntil?: "load" | "networkidle0" | "domcontentloaded" },
  ): Promise<void> {
    await this.ensurePage().goto(url, { waitUntil: opts?.waitUntil ?? "load" });
  }

  async waitForSelector(selector: string, timeoutMs = 10_000): Promise<boolean> {
    try {
      await this.ensurePage().waitForSelector(selector, { timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async scrollToText(text: string): Promise<ScrollResult> {
    const page = this.ensurePage();
    const result = await page.evaluate((target: string) => {
      function collect(t: string): Element[] {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const out: Element[] = [];
        const seen = new Set<Element>();
        let node: Node | null = walker.nextNode();
        while (node) {
          if (node.textContent && node.textContent.includes(t)) {
            const el = node.parentElement;
            if (el && !seen.has(el)) {
              seen.add(el);
              out.push(el);
            }
          }
          node = walker.nextNode();
        }
        return out;
      }
      const els = collect(target);
      if (els.length === 0) return { matched: 0, scrolled: false };
      // 曖昧一致対策: 最も下（絶対 Y 最大）の要素を選び、見落とされやすい本命に寄せる
      let lowest = els[0] as Element;
      let maxY = -Infinity;
      for (const el of els) {
        const y = el.getBoundingClientRect().top + window.scrollY;
        if (y > maxY) {
          maxY = y;
          lowest = el;
        }
      }
      lowest.scrollIntoView({ block: "center", inline: "nearest" });
      return { matched: els.length, scrolled: true };
    }, text);
    return { matched: result.matched, strategy: "text", scrolled: result.scrolled };
  }

  async scrollToSelector(selector: string): Promise<ScrollResult> {
    const page = this.ensurePage();
    const matched = await page.evaluate((sel: string) => {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) return 0;
      const last = els[els.length - 1] as HTMLElement;
      last.scrollIntoView({ block: "center", inline: "nearest" });
      return els.length;
    }, selector);
    return {
      matched,
      strategy: "selector",
      scrolled: matched > 0,
    };
  }

  async screenshot(opts: ScreenshotOptions): Promise<ScreenshotResult> {
    const page = this.ensurePage();
    const fullPage = opts.fullPage ?? false;
    const buffer = (await page.screenshot({
      fullPage,
      type: "png",
    })) as Uint8Array;
    await mkdir(dirname(opts.path), { recursive: true });
    await writeFile(opts.path, buffer);
    const base64 = Buffer.from(buffer).toString("base64");
    return { path: opts.path, base64, fullPage };
  }

  async getConsoleLogs(): Promise<ConsoleLogEntry[]> {
    return [...this.consoleLogs];
  }

  async queryDom(selector: string): Promise<DomQueryResult> {
    const page = this.ensurePage();
    return page.evaluate((sel: string) => {
      const els = document.querySelectorAll(sel);
      const first = els[0] as HTMLElement | undefined;
      return {
        found: els.length > 0,
        text: first?.textContent?.trim() ?? "",
        count: els.length,
      };
    }, selector);
  }

  async getPageContent(): Promise<string> {
    return this.ensurePage().evaluate(() => document.body?.innerText ?? "");
  }

  async getPageUrl(): Promise<string> {
    return this.ensurePage().url();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
