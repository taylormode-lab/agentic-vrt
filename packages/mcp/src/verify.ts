import type {
  BrowserController,
  CheckpointResult,
  Judge,
} from "@taylormode-lab/agentic-vrt-core";

export interface VerifyInput {
  url: string;
  intent: string;
  checkpoints: Array<{ element: string; expect: string }>;
}

export interface VerifyDeps {
  createBrowser: () => Promise<BrowserController>;
  createJudge: (ctx: { browser: BrowserController; screenshotPath: string }) => Judge;
  screenshotPath: string;
}

/**
 * 1ページを対象に、自律判定エージェントで検証する。
 * ブラウザは必ず close する（finally）。
 */
export async function runVerify(
  input: VerifyInput,
  deps: VerifyDeps,
): Promise<CheckpointResult[]> {
  const browser = await deps.createBrowser();
  try {
    await browser.navigate(input.url);
    const judge = deps.createJudge({ browser, screenshotPath: deps.screenshotPath });
    return await judge.judge({ intent: input.intent, checkpoints: input.checkpoints });
  } finally {
    await browser.close();
  }
}
