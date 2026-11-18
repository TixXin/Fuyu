import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateManifest } from "@fuyu/plugin-manifest";
import { dataDirOf } from "./data.mjs";

export const PACKAGES_DIR = "packages";
export const DEV_PREFIX = "dev";
export const INSTALLED_SOURCES = ["market", "manual"];
export const SOURCES = [...INSTALLED_SOURCES, "dev"];
export const SOURCE = Symbol.for("fuyu.plugin-source");
export const CLIENT_ONLY = new URL("./client-only.mjs", import.meta.url).href;
const WINDOW = /^[a-z][a-z0-9-]{0,63}$/;

function rejection(reason, errors = []) {
  return Object.assign(new Error(reason), { errors });
}

function inside(root, file) {
  const path = relative(root, file);
  return Boolean(path) && !path.startsWith("..") && !isAbsolute(path);
}

function entryFile(root, path, field) {
  let file;
  try {
    file = realpathSync(join(root, ...path.split("/")));
  } catch {
    throw rejection(`${field} names ${path}, which is not in ${root}`);
  }
  if (!inside(root, file) || !statSync(file).isFile()) throw rejection(`${field} names ${path}, which is not a file inside ${root}`);
  return file;
}

function declaredOf(app) {
  return {
    provides: [...(app.provides ?? []), ...(app.replaces ?? [])],
    client: Object.keys(app.client ?? {}),
    slots: [...(app.slots ?? [])],
  };
}

export function readManifest(root, options) {
  let text;
  try {
    text = readFileSync(join(root, "package.json"), "utf8");
  } catch (error) {
    throw rejection(`there is no package.json in ${root} (${error?.code ?? error?.message ?? error})`);
  }
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch (error) {
    throw rejection(`the package.json in ${root} is not valid JSON: ${error.message}`);
  }
  const result = validateManifest(pkg, options);
  if (!result.ok) throw rejection(`its package.json does not pass the check: ${result.errors.map((issue) => issue.message).join("; ")}`, result.errors);
  const app = result.app;
  const host = app.host === undefined ? null : entryFile(root, app.host, "fuyu.host");
  const clients = Object.entries(app.client ?? {}).map(([window, path]) => {
    if (!WINDOW.test(window)) throw rejection(`fuyu.client.${window}: ${window} is not a window name`);
    return { window, file: entryFile(root, path, `fuyu.client.${window}`) };
  });
  return { package: pkg.name, version: pkg.version, host, clients, declared: declaredOf(app) };
}

function installedRoot(id, packages) {
  let root;
  try {
    root = dataDirOf(packages, id);
  } catch {
    throw rejection(`${id} is not a package name, so it has no folder under ${packages}`);
  }
  try {
    return realpathSync(root);
  } catch {
    throw rejection(`${id} is not installed: ${root} is missing`);
  }
}

function devRoot(path, dir) {
  if (typeof path !== "string" || !path) throw rejection('a plugin with source "dev" needs path, the folder that holds its package.json');
  const root = resolve(dir, path);
  try {
    return realpathSync(root);
  } catch {
    throw rejection(`the development folder ${root} is missing`);
  }
}

export function sourceOf(options, { dir, appVersion }) {
  const { source, id } = options;
  if (!SOURCES.includes(source)) throw rejection(`source is ${JSON.stringify(source)}; use ${SOURCES.join(", ")}`);
  if (source === "dev") {
    const root = devRoot(options.path, dir);
    return { source, root, ...readManifest(root, { allowExperimental: true, official: true }) };
  }
  const root = installedRoot(id, join(dir, PACKAGES_DIR));
  const manifest = readManifest(root, { allowExperimental: false, appVersion, official: source === "market" });
  if (manifest.package !== id) throw rejection(`the package in ${root} is ${manifest.package}, not ${id}`);
  return { source, root, ...manifest };
}

export function withSource(options, context) {
  const { kind: _kind, ...rest } = options;
  try {
    const meta = sourceOf(options, context);
    return { ...rest, name: meta.host ? pathToFileURL(meta.host).href : CLIENT_ONLY, [SOURCE]: meta };
  } catch (error) {
    return { ...rest, name: CLIENT_ONLY, [SOURCE]: { source: options.source, rejected: { reason: error.message, errors: error.errors ?? [] } } };
  }
}

export function withSources(entries, context) {
  return entries.map((options) => {
    if (options === null || typeof options !== "object" || Array.isArray(options) || options[SOURCE]) return options;
    if (options.group === true && Array.isArray(options.config)) return { ...options, config: withSources(options.config, context) };
    return options.source === undefined ? options : withSource(options, context);
  });
}
