import { tryGit } from "./settings.mjs";

export function conflictedFiles(output) {
  const lines = output.split("\n").slice(1);
  const end = lines.findIndex((line) => !line.trim());
  return [...new Set((end < 0 ? lines : lines.slice(0, end)).map((line) => line.trim()).filter(Boolean))];
}

export function mergeTree(ours, theirs, base = null) {
  const args = ["merge-tree", "--write-tree", "--name-only", ...(base ? [`--merge-base=${base}`] : []), ours, theirs];
  const result = tryGit(args);
  if (result.ok) return { tree: result.out.split("\n")[0], conflicts: [] };
  return { tree: null, conflicts: conflictedFiles(result.out) };
}
