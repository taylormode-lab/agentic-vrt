export interface ConsoleLogEntry {
  type: "error" | "warning" | "log" | "info" | "debug";
  text: string;
}

export interface ScreenshotResult {
  /** 保存先パス */
  path: string;
  /** PNG の base64（LLM 送信用） */
  base64: string;
  /** ページ全体撮影なら true */
  fullPage: boolean;
}

export interface ScrollResult {
  /** 一致した要素数 */
  matched: number;
  /** スクロール手段 */
  strategy: "selector" | "text" | "none";
  /** 実際にスクロールして画面内に入れたか */
  scrolled: boolean;
}

export interface DomQueryResult {
  found: boolean;
  /** 要素の可視テキスト（先頭一致要素） */
  text: string;
  /** 一致要素数 */
  count: number;
}

export interface ScreenshotOptions {
  path: string;
  /** 既定 false。true でページ全体を 1 枚に撮る */
  fullPage?: boolean;
}

/**
 * 自律判定エージェントが利用するブラウザ操作の抽象。
 * 実装は puppeteer-core（ローカル Chrome）。テストではモック差し替え可能。
 */
export interface BrowserController {
  navigate(url: string, opts?: { waitUntil?: "load" | "networkidle0" | "domcontentloaded" }): Promise<void>;
  waitForSelector(selector: string, timeoutMs?: number): Promise<boolean>;
  /** テキストに一致する要素のうち、最も下にある（=見落とされやすい）ものを画面内へスクロール */
  scrollToText(text: string): Promise<ScrollResult>;
  scrollToSelector(selector: string): Promise<ScrollResult>;
  screenshot(opts: ScreenshotOptions): Promise<ScreenshotResult>;
  getConsoleLogs(): Promise<ConsoleLogEntry[]>;
  queryDom(selector: string): Promise<DomQueryResult>;
  getPageContent(): Promise<string>;
  getPageUrl(): Promise<string>;
  close(): Promise<void>;
}
