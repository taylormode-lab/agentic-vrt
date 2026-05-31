#!/usr/bin/env node
// Agentic VRT bootstrap: consumer リポジトリへ VRT を冪等に導入する。
// npm install は実行しない（依存追加の記録と雛形生成のみ）。
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const cwd = process.cwd();
const CLI_PKG = "@taylormode-lab/agentic-vrt-cli";
const MCP_PKG = "@taylormode-lab/agentic-vrt-mcp";
const VERSION_RANGE = "^0.1.0";
const log = (m) => console.log(`[vrt-bootstrap] ${m}`);

function ensureNpmrc() {
  const p = join(cwd, ".npmrc");
  const lines = [
    "@taylormode-lab:registry=https://npm.pkg.github.com",
    "//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}",
  ];
  const current = existsSync(p) ? readFileSync(p, "utf-8") : "";
  const missing = lines.filter((l) => !current.includes(l.split("=")[0]));
  if (missing.length === 0) return log(".npmrc OK");
  appendFileSync(p, (current && !current.endsWith("\n") ? "\n" : "") + missing.join("\n") + "\n");
  log(`.npmrc updated (+${missing.length} line)`);
}

function ensureDevDep() {
  const p = join(cwd, "package.json");
  if (!existsSync(p)) return log("package.json なし: devDep 追加をスキップ");
  const pkg = JSON.parse(readFileSync(p, "utf-8"));
  pkg.devDependencies = pkg.devDependencies ?? {};
  let changed = false;
  for (const dep of [CLI_PKG, MCP_PKG]) {
    if (!pkg.devDependencies[dep]) {
      pkg.devDependencies[dep] = VERSION_RANGE;
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
    log("package.json に devDependencies を追加（npm install は手動で）");
  } else {
    log("devDependencies OK");
  }
}

function ensureMcpJson() {
  const dir = join(cwd, ".cursor");
  const p = join(dir, "mcp.json");
  mkdirSync(dir, { recursive: true });
  const config = existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : {};
  config.mcpServers = config.mcpServers ?? {};
  if (!config.mcpServers["agentic-vrt"]) {
    config.mcpServers["agentic-vrt"] = {
      command: "npx",
      args: ["-y", MCP_PKG],
      env: { ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}" },
    };
    writeFileSync(p, JSON.stringify(config, null, 2) + "\n");
    log(".cursor/mcp.json に agentic-vrt を登録");
  } else {
    log(".cursor/mcp.json OK");
  }
}

function ensureTemplates() {
  const vrt = join(cwd, "vrt");
  const scenarios = join(vrt, "scenarios");
  mkdirSync(scenarios, { recursive: true });

  const adapter = join(vrt, "adapter.mjs");
  if (!existsSync(adapter)) {
    writeFileSync(
      adapter,
      `// プロジェクト固有処理。teardown / restoreEnv は run 失敗時も必ず実行される。
export default {
  name: ${JSON.stringify(require_name())},
  // async prepareEnv() {},
  async startServer() {
    // 例: prod build して起動し baseUrl を返す
    return { baseUrl: "http://localhost:3000" /*, serverLogPath: "vrt/reports/.server.log" */ };
  },
  // async seed() {},
  // async teardown() {},
  // async restoreEnv() {},
};
`,
    );
    log("vrt/adapter.mjs 雛形を生成");
  } else {
    log("vrt/adapter.mjs OK");
  }

  const sample = join(scenarios, "example.yaml");
  if (!existsSync(sample)) {
    writeFileSync(
      sample,
      `scenario: トップページ
priority: critical
preconditions:
  baseUrl: http://localhost:3000
steps:
  - id: hero
    intent: トップのヒーロー領域が表示されているか確認する
    navigate: /
    checkpoints:
      - element: ヒーロー
        expect: 見出しとCTAが視認できる
`,
    );
    log("vrt/scenarios/example.yaml 雛形を生成");
  } else {
    log("vrt/scenarios/example.yaml OK");
  }
}

function require_name() {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    return pkg.name ?? "app";
  } catch {
    return "app";
  }
}

function checkSkill() {
  const skill = join(homedir(), ".cursor", "skills", "vrt", "SKILL.md");
  if (existsSync(skill)) {
    log("グローバル skill 検出: ~/.cursor/skills/vrt/SKILL.md");
  } else {
    log("注意: ~/.cursor/skills/vrt/SKILL.md が無い。VRT スキルを配置すると運用が統一される。");
  }
}

ensureNpmrc();
ensureDevDep();
ensureMcpJson();
ensureTemplates();
checkSkill();
log("完了。次: `gh auth refresh -s read:packages` 後に `npm install`、その後 `npx agentic-vrt run`。");
