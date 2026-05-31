/**
 * 起動したテスト対象サーバーの情報。
 */
export interface StartedServer {
  /** シナリオの相対パス解決に使う基底URL（例: http://localhost:3333） */
  baseUrl: string;
  /** サーバーログのパス（judge の get_server_log 用、任意） */
  serverLogPath?: string;
}

/**
 * プロジェクト固有処理（env 切替・サーバー起動・seed・後始末）を CLI に注入する契約。
 * core はこのフックを呼ぶだけで、Supabase/Stripe/tunnel 等の固有事情を一切持たない。
 *
 * ライフサイクル保証: prepareEnv → startServer → seed → (run) → teardown → restoreEnv。
 * teardown / restoreEnv は run が失敗しても必ず実行される（env 復元漏れを構造的に防ぐ）。
 */
export interface VrtAdapter {
  name: string;
  prepareEnv?(): Promise<void> | void;
  startServer?(): Promise<StartedServer> | StartedServer;
  seed?(): Promise<void> | void;
  teardown?(): Promise<void> | void;
  restoreEnv?(): Promise<void> | void;
}
