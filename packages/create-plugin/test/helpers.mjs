import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";
import { scaffold } from "@fuyu/create-plugin";

export const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const scratch = mkdtempSync(join(tmpdir(), "create-plugin-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

export function tempDir(name = "dir") {
  const dir = join(scratch, `${++next}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const OPTIONS = { owner: "SomeOne", name: "fuyu-pomodoro", displayName: "Pomodoro", displayNameZh: "番茄钟" };

export function install(dir) {
  const { devDependencies } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const [name, spec] of Object.entries(devDependencies)) {
    const source = spec.startsWith("file:") ? spec.slice("file:".length) : join(PACKAGE_ROOT, "node_modules", name);
    const target = join(dir, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(realpathSync(source), target, "junction");
  }
}

export function generate(input = {}) {
  const result = scaffold({ ...OPTIONS, dir: join(tempDir(input.name ?? OPTIONS.name), "project"), ...input });
  install(result.options.dir);
  return result;
}

export function run(dir, script, args = []) {
  const result = spawnSync(process.execPath, [join(dir, "node_modules", script), ...args], { cwd: dir, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}`, stdout: result.stdout };
}

export const TSC = "typescript/bin/tsc";
export const ESLINT = "eslint/bin/eslint.js";
