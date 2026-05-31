# AGENTS.md — 開発規約

## 原則

- **TDD 準拠**: 仕様はまずテスト（Red）として書き、最小実装で通し（Green）、整える（Refactor）。
- **TypeScript strict**: `any` / 未narrowな `unknown` 禁止。型は明示的に定義する。
- **ESM / NodeNext**: すべて ESM。相対 import は拡張子 `.js` を付ける（NodeNext 解決）。
- 信頼境界の内側（Node プロセス）でのみ API キーを扱う。ブラウザ側に秘密値を出さない。

## テスト層

- **L1 ユニット (vitest)**: 純粋ロジック。LLM とブラウザはモック。判定ループ制御・ツール I/O・シナリオパースなど。
- **L2 統合 (vitest + 実 Chrome)**: `packages/core/test/fixtures/` の固定 HTML に対して puppeteer-core を実起動し、ツール（scroll / waitFor / screenshot / console / dom）の挙動を検証。
- **L3 受入**: consumer リポ（例: yktt-studio）で実アプリに対して実行。

## ディレクトリ

- `packages/core/src` — 実装、`packages/core/test` — テストとフィクスチャ。
- 各パッケージは `tsc -b` でビルドし `dist/` を出力（GitHub Packages 配布対象）。

## 依存追加

- 必ずパッケージマネージャ（`npm install`）で最新を追加する。バージョンを手で捏造しない。
