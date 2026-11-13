import { execFileSync } from "node:child_process";
import path from "node:path";

export function mainCheckout(cwd = process.cwd()) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
  return path.dirname(path.resolve(cwd, common));
}

export const targetDir = (main, name = "") => path.join(main, "src-tauri", "target", name);

export const PUBLISH_DIR = "publish";
