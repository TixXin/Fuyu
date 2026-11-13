import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mainCheckout, targetDir } from "./build-dirs.mjs";
import { backgroundBuildEnv, lowerPriority } from "./build-load.mjs";
import { pruneMainTarget } from "./prune-build-cache.mjs";
import { readVersion, VERSION_FILES, writeVersion } from "./release/versions.mjs";

const RUST_INPUTS = ["src-tauri/", "plugins/"];

const CHECKED_DOCS = ["docs/plugins/api.md"];

const DOCS_CHECKS = ["pnpm run check:tasks"];

const MAX_PASSES = 40;

const ATTRIBUTION = /^(Co-Authored-By: Claude|🤖 Generated with \[Claude Code\])/im;

export function attributedCommits(commits, ownEmail = "") {
  const own = ownEmail.trim().toLowerCase();
  return commits
    .filter(({ author = "" }) => !own || author.trim().toLowerCase() === own)
    .filter(({ body }) => ATTRIBUTION.test(body))
    .map(({ subject }) => subject);
}

export function needsRust(files, versionOnly = () => false) {
  return files.some((file) => RUST_INPUTS.some((prefix) => file.startsWith(prefix)) && !versionOnly(file));
}

export function versionOnlyChange(file, before, after) {
  const kind = Object.keys(VERSION_FILES).find((key) => VERSION_FILES[key] === file);
  if (!kind || before === null || after === null) return false;
  const normalize = (text) => text.replace(/\r\n/g, "\n");
  const version = readVersion(kind, after);
  if (version === null || readVersion(kind, before) === null) return false;
  return normalize(writeVersion(kind, before, version)) === normalize(after);
}

export function docsOnly(files) {
  return files.length > 0 && files.every((file) => file.endsWith(".md") && !CHECKED_DOCS.includes(file));
}

export function releaseBumpOnly(files, versionOnly = () => false) {
  const isDoc = (file) => file.endsWith(".md") && !CHECKED_DOCS.includes(file);
  const isVersion = (file) => Object.values(VERSION_FILES).includes(file) && versionOnly(file);
  return files.some(isVersion) && files.every((file) => isDoc(file) || isVersion(file));
}

export function checksFor(files, versionOnly = () => false) {
  if (files && docsOnly(files)) return { frontend: "docs", rust: false };
  if (files && releaseBumpOnly(files, versionOnly)) return { frontend: "release", rust: false };
  return { frontend: "full", rust: !files || needsRust(files, versionOnly) };
}

export function versionMismatch(read = (file) => readFileSync(file, "utf8")) {
  const found = Object.entries(VERSION_FILES).map(([kind, file]) => [file, readVersion(kind, read(file))]);
  const first = found[0][1];
  return first && found.every(([, version]) => version === first)
    ? null
    : `version fields disagree: ${found.map(([file, version]) => `${file}=${version}`).join(", ")}`;
}

export function recordPass(passes, tree, kinds, now = Date.now()) {
  const next = { ...passes, [tree]: { ...passes[tree], ...Object.fromEntries(kinds.map((kind) => [kind, now])) } };
  const newest = (key) => Math.max(...Object.values(next[key]));
  const trees = Object.keys(next).sort((a, b) => newest(b) - newest(a));
  return Object.fromEntries(trees.slice(0, MAX_PASSES).map((key) => [key, next[key]]));
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedFiles() {
  try {
    return git(["diff", "--name-only", "origin/main...HEAD"]).split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

function versionBumpOnly(file) {
  let before = null;
  let after = null;
  try {
    before = git(["show", `origin/main:${file}`]);
    after = readFileSync(file, "utf8").trim();
  } catch {
    return false;
  }
  return versionOnlyChange(file, before, after);
}

function cleanTree() {
  try {
    return git(["status", "--porcelain", "--untracked-files=no"]) ? null : git(["rev-parse", "HEAD^{tree}"]);
  } catch {
    return null;
  }
}

function passesFile() {
  return path.join(path.resolve(git(["rev-parse", "--git-common-dir"])), "land-check-passes.json");
}

function readPasses() {
  try {
    return JSON.parse(readFileSync(passesFile(), "utf8"));
  } catch {
    return {};
  }
}

function run(command, env = {}) {
  console.log(`[land-check] ${command}`);
  return spawnSync(command, { shell: true, stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;
}

function landingCommits() {
  try {
    return git(["log", "origin/main..HEAD", "--format=%ae%x1f%s%x1f%B%x1e"])
      .split("").map((entry) => entry.trim()).filter(Boolean)
      .map((entry) => {
        const [author, subject, body] = entry.split("");
        return { author, subject, body };
      });
  } catch {
    return [];
  }
}

function ownEmail() {
  try {
    return git(["config", "user.email"]).trim();
  } catch {
    return "";
  }
}

function main(args = []) {
  lowerPriority("land-check");
  const attributed = attributedCommits(landingCommits(), ownEmail());
  if (attributed.length) {
    console.error(`[land-check] remove the Claude attribution lines from: ${attributed.join("; ")}`);
    return 1;
  }
  if (run("node scripts/tasks/tasks.mjs landing") !== 0) return 1;
  const files = changedFiles();
  const { frontend, rust } = checksFor(files, versionBumpOnly);
  const tree = cleanTree();
  const passed = tree ? readPasses()[tree] ?? {} : {};
  const record = (kind) => {
    if (tree) writeFileSync(passesFile(), JSON.stringify(recordPass(readPasses(), tree, [kind]), null, 2));
  };

  if (frontend === "docs") {
    console.log("[land-check] only Markdown docs changed; running the doc checks");
    for (const command of DOCS_CHECKS) if (run(command) !== 0) return 1;
    return 0;
  }
  if (frontend === "release") {
    console.log("[land-check] a release bump (only the app version and Markdown); running the doc and version checks");
    const mismatch = versionMismatch();
    if (mismatch) {
      console.error(`[land-check] ${mismatch}; set them together with pnpm release:version`);
      return 1;
    }
    for (const command of DOCS_CHECKS) if (run(command) !== 0) return 1;
    return 0;
  }
  if (args.includes("--light")) {
    console.log("[land-check] pnpm check and cargo test are left to CI's check on the pull request; run pnpm verify to run them here");
    return 0;
  }
  if (passed.check) {
    console.log(`[land-check] tree ${tree.slice(0, 10)} already passed pnpm check; not running it again`);
  } else {
    if (run("pnpm check") !== 0) return 1;
    record("check");
  }
  if (!rust) {
    console.log("[land-check] no Rust inputs changed; skipping cargo test");
    return 0;
  }
  if (passed.cargo) {
    console.log(`[land-check] tree ${tree.slice(0, 10)} already passed cargo test; not running it again`);
    return 0;
  }
  const target = process.env.CARGO_TARGET_DIR ?? targetDir(mainCheckout(), "agents");
  if (run("cargo test --manifest-path src-tauri/Cargo.toml", { CARGO_TARGET_DIR: target, ...backgroundBuildEnv() }) !== 0) return 1;
  record("cargo");
  pruneMainTarget();
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
