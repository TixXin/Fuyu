import { readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const BUILTINS_FILE = "builtins.json";
export const BUILTINS_FORMAT = 1;
export const BUILTIN_KINDS = ["essential", "builtin"];
export const BUILTIN_PREFIX = "builtin";
export const BUILTIN_ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const FILE_KEYS = ["disabled", "config"];

function safeRelative(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return false;
  return path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function inside(dir, file) {
  const path = relative(dir, file);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== ".." && !/^[A-Za-z]:/.test(path);
}

function real(path, what) {
  try {
    return realpathSync(path);
  } catch (error) {
    throw new Error(`the built-in plugin list names ${what} ${path}, which is missing: ${error?.message ?? error}`);
  }
}

export function readBuiltins(dir) {
  const base = realpathSync(dir);
  const file = join(base, BUILTINS_FILE);
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`could not read the built-in plugin list ${file}: ${error?.message ?? error}`);
  }
  if (catalog?.format !== BUILTINS_FORMAT || !Array.isArray(catalog.plugins)) {
    throw new Error(`${file} must be { "format": ${BUILTINS_FORMAT}, "plugins": [...] }`);
  }
  const seen = new Set();
  const plugins = catalog.plugins.map((plugin, index) => {
    const at = `${file} plugins[${index}]`;
    if (!BUILTIN_ID.test(plugin?.id ?? "")) throw new Error(`${at}: id must be lowercase letters, digits, "." and "-"`);
    if (seen.has(plugin.id)) throw new Error(`${at}: the id ${plugin.id} is listed twice`);
    seen.add(plugin.id);
    const kind = plugin.kind ?? "builtin";
    if (!BUILTIN_KINDS.includes(kind)) throw new Error(`${at}: kind must be ${BUILTIN_KINDS.join(" or ")}`);
    if (!safeRelative(plugin.root) || !safeRelative(plugin.host)) throw new Error(`${at}: root and host must be relative paths with "/" and no ".."`);
    const root = real(join(base, ...plugin.root.split("/")), "the folder");
    if (!inside(base, root)) throw new Error(`${at}: the folder ${root} is outside ${base}`);
    const host = real(join(root, ...plugin.host.split("/")), "the host file");
    if (!inside(root, host)) throw new Error(`${at}: the host file ${host} is outside ${root}`);
    return { id: plugin.id, kind, root, host: pathToFileURL(host).href };
  });
  return { dir: base, plugins };
}

export function builtinEntries(catalog) {
  return (catalog?.plugins ?? []).map(({ id, host, kind }) => ({ id, name: host, kind }));
}

export function builtinMounts(catalog) {
  return (catalog?.plugins ?? []).map(({ id, root }) => ({ prefix: `${BUILTIN_PREFIX}/${id}`, dir: root }));
}

function thirdParty(options, builtinIds, warn, nested) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) return [options];
  if (nested && typeof options.id === "string" && builtinIds.has(options.id)) {
    warn(`the entry ${options.id} inside a group has the id of a built-in plugin and is left out`);
    return [];
  }
  const { kind, ...rest } = options;
  if (rest.group === true && Array.isArray(rest.config)) {
    rest.config = rest.config.flatMap((child) => thirdParty(child, builtinIds, warn, true));
  }
  return [rest];
}

export function withBuiltins(entries, builtins, warn = () => {}) {
  const list = Array.isArray(entries) ? entries : [];
  const builtinIds = new Set(builtins.map((entry) => entry.id));
  const switches = new Map();
  const rest = [];
  for (const options of list) {
    if (typeof options?.id === "string" && builtinIds.has(options.id)) switches.set(options.id, options);
    else rest.push(...thirdParty(options, builtinIds, warn, false));
  }
  const merged = builtins.map((builtin) => {
    const entry = { ...builtin };
    const written = switches.get(builtin.id);
    for (const key of FILE_KEYS) if (written && written[key] !== undefined) entry[key] = written[key];
    return entry;
  });
  return [...merged, ...rest.filter((options) => !leftoverSwitch(options, warn))];
}

function leftoverSwitch(options, warn) {
  if (typeof options?.id !== "string" || options.name !== undefined) return false;
  if (!Object.keys(options).every((key) => key === "id" || FILE_KEYS.includes(key))) return false;
  warn(`the entry ${options.id} only switches a plugin on or off, and no built-in plugin has that id; it is ignored`);
  return true;
}
