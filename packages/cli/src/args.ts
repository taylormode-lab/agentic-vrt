export interface ParsedArgs {
  scenarioDir: string;
  reportDir: string;
  scenarioFilter?: string;
  baseUrl?: string;
  adapterPath?: string;
  serverLogPath?: string;
  model: string;
  maxIterations: number;
}

const DEFAULTS = {
  scenarioDir: "vrt/scenarios",
  reportDir: "vrt/reports",
  model: "claude-sonnet-4-6",
  maxIterations: 8,
};

/**
 * argv（プログラム名・node を除いた配列）を解析する。
 * 例: ["--scenario-dir", "vrt/scenarios", "--scenario", "管理ダッシュボード"]
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    scenarioDir: DEFAULTS.scenarioDir,
    reportDir: DEFAULTS.reportDir,
    model: DEFAULTS.model,
    maxIterations: DEFAULTS.maxIterations,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      i++;
      return v;
    };
    switch (arg) {
      case "--scenario-dir":
        out.scenarioDir = next();
        break;
      case "--report-dir":
        out.reportDir = next();
        break;
      case "--scenario":
        out.scenarioFilter = next();
        break;
      case "--base-url":
        out.baseUrl = next();
        break;
      case "--adapter":
        out.adapterPath = next();
        break;
      case "--server-log":
        out.serverLogPath = next();
        break;
      case "--model":
        out.model = next();
        break;
      case "--max-iterations":
        out.maxIterations = Number(next());
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}
