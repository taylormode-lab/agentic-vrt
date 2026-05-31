import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

type BaselineIndex = Record<string, string>;

/**
 * ベースライン（前回成功スクショ）の保存・取得。
 * judge エージェントが絶対判定を行うため必須ではないが、差分比較の参照として提供する。
 */
export class BaselineStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private indexPath(): string {
    return join(this.dir, "index.json");
  }

  private key(scenario: string, stepId: string): string {
    return `${scenario}::${stepId}`;
  }

  private fileName(scenario: string, stepId: string): string {
    return `${scenario}__${stepId}.png`.replace(/[^\w.\-]+/g, "_");
  }

  async loadIndex(): Promise<BaselineIndex> {
    try {
      const raw = await readFile(this.indexPath(), "utf-8");
      return JSON.parse(raw) as BaselineIndex;
    } catch {
      return {};
    }
  }

  async saveBaseline(scenario: string, stepId: string, pngPath: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const fname = this.fileName(scenario, stepId);
    const dest = join(this.dir, fname);
    await copyFile(pngPath, dest);
    const index = await this.loadIndex();
    index[this.key(scenario, stepId)] = fname;
    await writeFile(this.indexPath(), JSON.stringify(index, null, 2));
    return dest;
  }

  async getBaselinePath(scenario: string, stepId: string): Promise<string | null> {
    const index = await this.loadIndex();
    const fname = index[this.key(scenario, stepId)];
    if (!fname) return null;
    const p = join(this.dir, fname);
    return existsSync(p) ? p : null;
  }
}
