import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export const WATCH_IGNORED_DIRS = [
  "src-tauri",
  "plugins",
  "tests/regression/snapshots",
  "docs",
  "video",
  ".claude",
];

export const WATCH_IGNORED_GLOBS = WATCH_IGNORED_DIRS.map((dir) => `**/${dir}/**`);

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/(?<=.)\/$/, "");
}

function normalizeComparable(value) {
  const normalized = normalizeSlashes(value);
  return /^[A-Za-z]:(\/|$)/.test(normalized)
    ? `${normalized[0].toLowerCase()}${normalized.slice(1)}`
    : normalized;
}

function isAbsoluteWatchPath(normalized) {
  return normalized.startsWith("/") || /^[A-Za-z]:(\/|$)/.test(normalized);
}

function resolveWatchRoots(root) {
  const roots = [normalizeComparable(root)];
  try {
    const real = normalizeComparable(realpathSync(root));
    if (!roots.includes(real)) roots.push(real);
  } catch {
    return roots;
  }
  return roots;
}

function relativeToWatchRoots(filePath, roots) {
  const normalized = normalizeSlashes(filePath);
  if (normalized === "" || normalized === ".") return "";
  if (!isAbsoluteWatchPath(normalized)) {
    return normalized.replace(/^(\.\/)+/, "");
  }
  const comparable = normalizeComparable(normalized);
  for (const root of roots) {
    if (comparable === root) return "";
    const prefix = root === "/" ? "/" : `${root}/`;
    if (comparable.startsWith(prefix)) return normalized.slice(prefix.length);
  }
  return null;
}

export function createWatchIgnored(root = REPO_ROOT) {
  const roots = resolveWatchRoots(root);
  return (filePath) => {
    if (typeof filePath !== "string") return false;
    const rel = relativeToWatchRoots(filePath, roots);
    if (!rel) return false;
    return WATCH_IGNORED_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
  };
}

export function isWatchIgnored(filePath, root = REPO_ROOT) {
  return createWatchIgnored(root)(filePath);
}
