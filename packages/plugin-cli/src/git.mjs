import { spawnSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function git(cwd, args, input) {
  const result = spawnSync("git", args, { cwd, input, maxBuffer: 1 << 30, windowsHide: true });
  if (result.error) throw new Error(`git is not available: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString("utf8").trim()}`);
  return result.stdout;
}

export function resolveCommit(cwd, revision) {
  return git(cwd, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${revision}^{commit}`]).toString("utf8").trim();
}

export function isCommit(cwd, revision) {
  try {
    return /^[0-9a-f]{40,64}$/.test(resolveCommit(cwd, revision));
  } catch {
    return false;
  }
}

export function repoPrefix(cwd) {
  return git(cwd, ["rev-parse", "--show-prefix"]).toString("utf8").trim();
}

export function readAt(cwd, commit, path) {
  return git(cwd, ["cat-file", "blob", `${commit}:${path}`]);
}

function parseBatch(output) {
  const blobs = new Map();
  let offset = 0;
  while (offset < output.length) {
    const end = output.indexOf(0x0a, offset);
    const [sha, type, size] = output.subarray(offset, end).toString("utf8").split(" ");
    if (type !== "blob") throw new Error(`git cat-file: ${sha} is a ${type}`);
    const start = end + 1;
    blobs.set(sha, output.subarray(start, start + Number(size)));
    offset = start + Number(size) + 1;
  }
  return blobs;
}

export function materialize(cwd, commit, prefix, target) {
  const args = ["ls-tree", "-r", "-z", "--full-tree", commit];
  if (prefix) args.push("--", prefix);
  const entries = git(cwd, args)
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      const [mode, type, sha] = line.slice(0, tab).split(" ");
      return { mode, type, sha, path: line.slice(tab + 1).slice(prefix.length) };
    })
    .filter((entry) => entry.type === "blob" && entry.path);
  const blobs = entries.length ? parseBatch(git(cwd, ["cat-file", "--batch"], `${[...new Set(entries.map((e) => e.sha))].join("\n")}\n`)) : new Map();
  const skipped = [];
  for (const entry of entries) {
    const file = join(target, ...entry.path.split("/"));
    mkdirSync(dirname(file), { recursive: true });
    const data = blobs.get(entry.sha);
    if (entry.mode === "120000") {
      try {
        symlinkSync(data.toString("utf8"), file);
      } catch {
        skipped.push(entry.path);
      }
      continue;
    }
    writeFileSync(file, data);
  }
  return { files: entries.length, skipped };
}
