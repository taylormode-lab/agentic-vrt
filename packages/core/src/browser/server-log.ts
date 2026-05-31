import { readFile } from "node:fs/promises";

/**
 * 文字列の末尾 maxLines 行を返す純粋関数。
 */
export function readLogTail(content: string, maxLines: number): string {
  if (maxLines <= 0) return "";
  const lines = content.split("\n");
  // 末尾に空行（ファイル末尾改行由来）があれば 1 つ落とす
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
}

/**
 * サーバーログファイルの末尾 maxLines 行を読む。
 * ファイルが無い・読めない場合は空文字（判定を落とさない）。
 */
export async function readServerLogTail(
  filePath: string,
  maxLines: number,
): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    return readLogTail(content, maxLines);
  } catch {
    return "";
  }
}
