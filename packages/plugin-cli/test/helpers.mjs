import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
export const REVIEW_FIXTURES = fileURLToPath(new URL("../../plugin-review/test/fixtures/", import.meta.url));

const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

export function tempDir(name = "dir") {
  const dir = join(scratch, `${++next}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function copyFixture(name = "hello", edit = () => {}, at = tempDir(name)) {
  const dir = join(at, name);
  cpSync(join(FIXTURES, name), dir, { recursive: true });
  edit(dir);
  return dir;
}

export function writeFiles(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

export function editJson(file, change) {
  const value = JSON.parse(readFileSync(file, "utf8"));
  change(value);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function gitRepo(dir) {
  const run = (...args) => {
    const result = spawnSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "core.autocrlf=false", ...args], { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  run("init", "-q");
  return {
    run,
    commit(message) {
      run("add", "-A");
      run("commit", "-q", "-m", message);
      return run("rev-parse", "HEAD");
    },
  };
}

export function capture(cwd) {
  const stdout = [];
  const stderr = [];
  return {
    io: { cwd, env: {}, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}
