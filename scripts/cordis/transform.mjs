import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";

const TEXT = /\.(m?[jt]sx?|d\.mts|json|md|rs|toml|ya?ml|css|html|svg|txt)$|(^|\/)(LICENSE|[A-Z-]+-LICENSE)$/;
const SCRIPT = /\.(m?[jt]sx?|d\.mts)$/;
const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bimport\.meta\.resolve\(\s*|\bdeclare\s+module\s+)(["'])([^"']+)\2/g;
const DIRS = ["plugin-base-macros", "plugin-base", "plugin-manifest", "plugin-market", "plugin-review", "plugin-cli", "create-plugin"];

export function isText(path) {
  return TEXT.test(path);
}

function walk(root, rel, skip, out) {
  const full = join(root, rel);
  if (!existsSync(full)) return;
  if (statSync(full).isFile()) {
    out.push(rel);
    return;
  }
  for (const name of readdirSync(full).sort()) {
    if (skip.includes(name)) continue;
    walk(root, rel ? `${rel}/${name}` : name, skip, out);
  }
}

export function sourceFiles(root, map) {
  const files = [];
  for (const tree of map.trees) {
    for (const path of tree.paths) {
      const found = [];
      walk(root, `${tree.from}/${path}`, map.skip, found);
      for (const from of found) {
        if (map.fuyuOnly.some((prefix) => from === prefix || from.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) continue;
        files.push({ from, to: tree.to + from.slice(tree.from.length) });
      }
    }
  }
  return files;
}

export function managedRoots(map) {
  return map.trees.flatMap((tree) => tree.paths.map((path) => `${tree.to}/${path}`));
}

function vendorTarget(map, to, specifier) {
  const pkg = map.vendor.specifiers[specifier];
  if (!pkg) return null;
  const rel = posix.relative(posix.dirname(to), `${map.vendor.dir}/${pkg}/lib/index.js`);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function dirFor(map, name) {
  const tree = map.trees.find((entry) => posix.basename(entry.from) === name);
  return tree ? posix.basename(tree.to) : name;
}

export function rename(map, text) {
  let out = text.replace(new RegExp(`((?:\\.\\./)+)(${DIRS.join("|")})/`, "g"), (_, up, name) => `${up}${dirFor(map, name)}/`);
  for (const [from, to] of map.names) {
    const pattern = /^[A-Za-z_]/.test(from) ? new RegExp(`(?<![A-Za-z0-9_@/.-])${from.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")}(?![A-Za-z0-9_])`, "g") : new RegExp(from.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&") + "(?![A-Za-z0-9_-])", "g");
    out = out.replace(pattern, to);
  }
  return out;
}

export function rewriteVendor(map, to, text) {
  if (!SCRIPT.test(to) || !to.startsWith(map.vendor.dir.split("/vendor/")[0])) return text;
  return text.replace(IMPORT, (match, head, quote, specifier) => {
    const target = vendorTarget(map, to, specifier);
    return target ? `${head}${quote}${target}${quote}` : match;
  });
}

export function transform(map, file, bytes) {
  if (!isText(file.to)) return bytes;
  const text = bytes.toString("utf8");
  return Buffer.from(rewriteVendor(map, file.to, rename(map, text)), "utf8");
}

export function exportFiles(root, map) {
  const out = new Map();
  for (const file of sourceFiles(root, map)) {
    const override = map.overrides[file.to];
    const bytes = override ? readFileSync(join(root, override)) : readFileSync(join(root, file.from));
    out.set(file.to, override ? bytes : transform(map, file, bytes));
  }
  for (const [to, from] of Object.entries(map.overrides)) {
    if (!out.has(to)) out.set(to, readFileSync(join(root, from)));
  }
  return out;
}

export function brokenImports(files) {
  const broken = [];
  for (const [path, bytes] of files) {
    if (!SCRIPT.test(path) || path.includes("/vendor/")) continue;
    for (const [, , , specifier] of bytes.toString("utf8").matchAll(IMPORT)) {
      if (specifier.startsWith("@fuyu/")) broken.push({ path, specifier });
      if (!specifier.startsWith(".") || !/(\.m?js|\/[^./]+)$/.test(specifier)) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), specifier));
      if (/\/(test|tests|examples)\//.test(`/${path}`) && !files.has(target)) continue;
      if (!files.has(target) && !files.has(`${target}.mjs`) && !files.has(`${target}/index.mjs`)) broken.push({ path, specifier });
    }
  }
  return broken;
}

export function fuyuNames(map, files) {
  const hits = [];
  for (const [path, bytes] of files) {
    if (!isText(path) || map.namesAllowedIn.some((part) => `/${path}`.includes(part))) continue;
    const lines = bytes.toString("utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/fuyu/i.test(line)) hits.push({ path, line: index + 1, text: line.trim().slice(0, 160) });
    });
  }
  return hits;
}

export function cordisFiles(cordis, map) {
  const files = [];
  for (const root of managedRoots(map)) walk(cordis, root, map.skip, files);
  return files;
}

export function compare(expected, cordis, map) {
  const actual = new Set(cordisFiles(cordis, map));
  const differs = [];
  const missing = [];
  for (const [path, bytes] of expected) {
    if (!actual.has(path)) missing.push(path);
    else if (!readFileSync(join(cordis, path)).equals(bytes)) differs.push(path);
    actual.delete(path);
  }
  return { differs, missing, extra: [...actual].sort() };
}
