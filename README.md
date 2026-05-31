# agentic-vrt

Agentic Visual Regression Testing platform.

従来の VRT は「ツールを持たない単発の画像分類 LLM + ビューポート固定スナップショット + scroll/wait/判定文言のハードコード」という静的設計で、当て損なうと flaky になっていた。本基盤は判定 LLM に**ブラウザ操作ツール**を与え、人間のように「見えなければ自分でスクロール / ロード中なら待って再撮影 / それでも無ければコンソール・サーバーログを確認」してから根拠付きで合否を出す**自律エージェント**へ作り替える。

## packages

- `@taylormode-lab/agentic-vrt-core` — ブラウザ操作ツール群 + 自律判定エージェント + シナリオ実行エンジン + reporter + baseline。品質の単一情報源（バージョン固定で全リポ統一）。
- `@taylormode-lab/agentic-vrt-cli` — pre-push / CI 入口（`agentic-vrt run`）。プロジェクト固有のアダプタ（env 準備・起動・seed・teardown）を受け取る。
- `@taylormode-lab/agentic-vrt-mcp` — ローカル stdio MCP サーバー。Cursor / Composer から「この画面を検証して」を対話的に呼ぶ。

## アーキテクチャの要点

- ブラウザ駆動はテスト対象と同一マシン必須のため、MCP は**ローカル stdio**（リモート常駐にしない）。
- `env 切替`・`seed`・`起動`等のプロジェクト固有処理は consumer 側の**アダプタ**に残し、core はアダプタのフックを呼ぶだけ。
- 配布は GitHub Packages（`@taylormode-lab` スコープ）。

## 開発

```bash
npm install
npm test          # vitest (TDD)
npm run build     # tsc -b 全パッケージ
npm run typecheck
```

詳細な開発規約は [AGENTS.md](./AGENTS.md) を参照。

## License

Apache License 2.0. 詳細は [LICENSE](./LICENSE) を参照（OSS / 公開パッケージ）。
