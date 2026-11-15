import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isSafeRelativePath } from "@fuyu/plugin-manifest";
import { BuildError } from "./errors.mjs";
import { OUTPUT_DIR } from "./entries.mjs";

export const DEFAULT_FILES = ["assets"];
const ALWAYS = /^(?:readme|changelog|license|licence|notice)(?:[.-][^/]*)?$/i;
const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const SKIP_DIRS = new Set([".git", "node_modules"]);
const GLOB = /[*?[\]{}!]/;

const toPosix = (path) => path.split(sep).join("/");

function stat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function inside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(":"));
}

export function selectFiles(dir, app, files, { exclude = [], warn = () => {} } = {}) {
  const selected = new Set();
  const excluded = (full) => exclude.some((path) => inside(full, path));
  const add = (path, origin) => {
    const full = join(dir, path);
    if (excluded(full)) return;
    const info = stat(full);
    if (!info) throw new BuildError(`${origin} lists "${path}" but it does not exist`, [{ path: origin, code: "missing", message: path }]);
    if (info.isSymbolicLink()) throw new BuildError(`"${path}" is a symbolic link; packages only hold regular files`, [{ path: origin, code: "symlink", message: path }]);
    if (info.isFile()) {
      selected.add(path);
      return;
    }
    if (!info.isDirectory()) throw new BuildError(`"${path}" is not a regular file`, [{ path: origin, code: "special", message: path }]);
    for (const entry of readdirSync(full).sort()) {
      if (SKIP_NAMES.has(entry)) continue;
      const child = `${path}/${entry}`;
      if (SKIP_DIRS.has(entry)) {
        warn({ code: "skipped", path: origin, message: `left out ${child}/` });
        continue;
      }
      add(child, origin);
    }
  };

  for (const entry of readdirSync(dir).sort()) {
    if (ALWAYS.test(entry) && stat(join(dir, entry))?.isFile()) selected.add(entry);
  }
  for (const path of files ?? DEFAULT_FILES) {
    const clean = path.replace(/^\.\//, "").replace(/\/+$/, "");
    if (GLOB.test(clean)) throw new BuildError(`files: "${path}" is a pattern; list files and folders instead`, [{ path: "files", code: "pattern", message: path }]);
    if (!isSafeRelativePath(clean)) throw new BuildError(`files: "${path}" must be a relative path inside the plugin`, [{ path: "files", code: "path", message: path }]);
    if (clean === OUTPUT_DIR || clean.startsWith(`${OUTPUT_DIR}/`) || clean === "package.json") continue;
    if (files === undefined && !stat(join(dir, clean))) continue;
    add(clean, "files");
  }
  const referenced = [
    ["fuyu.icon", app.icon],
    ...(app.screenshots ?? []).map((shot, index) => [`fuyu.screenshots[${index}].path`, shot?.path]),
    ["fuyu.config", app.config],
  ];
  for (const [field, path] of referenced) {
    if (typeof path !== "string" || path.startsWith(`${OUTPUT_DIR}/`)) continue;
    add(path, field);
  }
  return [...selected].map(toPosix).sort();
}
