import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { DEFAULT_OUT_DIR } from "./build.mjs";
import { isCommit, materialize, repoPrefix, resolveCommit } from "./git.mjs";

const SKIP = new Set([".git", "node_modules"]);

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function builtBy(dir) {
  try {
    return typeof JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))?.fuyu?.builtWith === "string";
  } catch {
    return false;
  }
}

export function createScratch(prefix = "fuyu-plugin-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  let next = 0;
  return {
    root,
    dir: (name) => join(root, `${++next}-${name}`),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function snapshotDirectory(dir, target) {
  const output = join(dir, DEFAULT_OUT_DIR);
  const outputs = existsSync(output) && builtBy(output) ? [dirname(output)] : [];
  cpSync(dir, target, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (source) => {
      if (source === dir) return true;
      if (SKIP.has(basename(source)) && isDirectory(source)) return false;
      return !outputs.some((output) => source === output || !relative(output, source).startsWith(".."));
    },
  });
  return target;
}

export function openSource(spec, { repo = process.cwd(), path, scratch, label }) {
  if (spec === "-") return null;
  const local = resolve(spec);
  if (isDirectory(local)) {
    return { kind: "directory", spec, dir: snapshotDirectory(local, scratch.dir(label)) };
  }
  const repoDir = resolve(repo);
  if (!isCommit(repoDir, spec)) throw new Error(`${spec} is neither a folder nor a commit in the git repository at ${repoDir}`);
  const commit = resolveCommit(repoDir, spec);
  const clean = path === undefined ? null : path.split(sep).join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  const prefix = clean === null ? repoPrefix(repoDir) : clean && clean !== "." ? `${clean}/` : "";
  const dir = scratch.dir(label);
  const result = materialize(repoDir, commit, prefix, dir);
  if (result.files === 0) throw new Error(`there are no files under "${prefix || "."}" at ${commit.slice(0, 12)}`);
  return { kind: "commit", spec, commit, prefix, dir, skipped: result.skipped };
}
