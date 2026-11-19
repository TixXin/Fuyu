import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import module from "node:module";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION_PARAM = "fuyu-v";
const SKIPPED = (name) => name === "node_modules" || name.startsWith(".");

const roots = new Map();
let installed = false;

function stamps(root, dir = root, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) stamps(root, path, out);
    else if (item.isFile()) {
      const { size, mtimeMs } = statSync(path);
      out.push(`${relative(root, path)}\0${size}\0${mtimeMs}`);
    }
  }
  return out;
}

export function packageToken(root, version) {
  const hash = createHash("sha256").update(root).update("\n");
  for (const line of stamps(root).sort()) hash.update(line).update("\n");
  return `${version}-${hash.digest("hex").slice(0, 16)}`;
}

function tokenOf(url) {
  if (typeof url !== "string" || !url.startsWith("file:")) return null;
  try {
    return new URL(url).searchParams.get(VERSION_PARAM);
  } catch {
    return null;
  }
}

function withToken(url, token) {
  const next = new URL(url);
  next.searchParams.set(VERSION_PARAM, token);
  return next.href;
}

function install() {
  if (installed) return;
  installed = true;
  module.registerHooks({
    resolve(specifier, context, next) {
      const result = next(specifier, context);
      const token = tokenOf(context.parentURL);
      const root = token === null ? undefined : roots.get(token);
      if (!root || !result?.url?.startsWith(root) || result.url.includes("?")) return result;
      return { ...result, url: withToken(result.url, token) };
    },
  });
}

export function versionedUrl(root, file, version) {
  install();
  const token = packageToken(root, version);
  const base = pathToFileURL(root).href;
  roots.set(token, base.endsWith("/") ? base : `${base}/`);
  return withToken(pathToFileURL(file).href, token);
}
