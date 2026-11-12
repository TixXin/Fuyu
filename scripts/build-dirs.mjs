import { execFileSync } from "node:child_process";
import path from "node:path";

export const LANE_PORT_BASE = 1500;

export function mainCheckout(cwd = process.cwd()) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
  return path.dirname(path.resolve(cwd, common));
}

export const targetDir = (main, name = "") => path.join(main, "src-tauri", "target", name);

export function laneNumber(worktree) {
  const parts = path.resolve(worktree).split(/[\\/]/);
  const number = Number(parts.at(-1));
  return /.-lanes$/.test(parts.at(-2) ?? "") && Number.isInteger(number) && number > 0 && number < 1000 ? number : null;
}

export const PUBLISH_DIR = "publish";

export const LANE_BUILD_DIR = "lane-build";

export function lanePreview(main, lane) {
  return {
    port: LANE_PORT_BASE + lane,
    identifier: `com.tixxin.fuyu.lane-${lane}`,
    target: targetDir(main, `lane-${lane}`),
    buildDir: targetDir(main, LANE_BUILD_DIR),
  };
}
