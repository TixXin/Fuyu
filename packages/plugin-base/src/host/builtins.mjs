import { readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CLIENT_ONLY, SOURCE, readManifest } from "./sources.mjs";

export const BUILTINS_FILE = "builtins.json";
export const BUILTINS_FORMAT = 1;
export const BUILTIN_KINDS = ["essential", "builtin"];
export const BUILTIN_PREFIX = "builtin";
export const BUILTIN_ID = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const FILE_KEYS = ["disabled", "config", "disabledServices"];

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
    if (!safeRelative(plugin.root) || (plugin.host !== undefined && !safeRelative(plugin.host))) throw new Error(`${at}: root and host must be relative paths with "/" and no ".."`);
    const root = real(join(base, ...plugin.root.split("/")), "the folder");
    if (!inside(base, root)) throw new Error(`${at}: the folder ${root} is outside ${base}`);
    if (plugin.host === undefined) return { id: plugin.id, kind, root, ...fromPackage(root, at) };
    const host = real(join(root, ...plugin.host.split("/")), "the host file");
    if (!inside(root, host)) throw new Error(`${at}: the host file ${host} is outside ${root}`);
    const provides = Array.isArray(plugin.provides) ? plugin.provides.filter((item) => typeof item === "string" && item.trim() !== "") : [];
    return { id: plugin.id, kind, root, host: pathToFileURL(host).href, clients: [], declared: null, ...(provides.length ? { provides } : {}) };
  });
  return { dir: base, plugins };
}

function fromPackage(root, at) {
  try {
    const manifest = readManifest(root, { official: true });
    return {
      host: manifest.host && pathToFileURL(manifest.host).href,
      clients: manifest.clients,
      declared: manifest.declared,
      displayName: manifest.displayName,
      commands: manifest.commands,
      configSchema: manifest.configSchema,
    };
  } catch (error) {
    throw new Error(`${at}: there is no host in the list, and ${error.message}`);
  }
}

export function builtinEntries(plugins = []) {
  return plugins.map(({ id, host, kind, root, clients = [], declared = null, provides, displayName = null, commands = [], configSchema = null }) => ({
    id,
    name: host ?? CLIENT_ONLY,
    kind,
    [SOURCE]: { source: "builtin", root, clients, declared, displayName, commands, configSchema, ...(provides?.length ? { provides } : {}) },
  }));
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
  const replacedByThirdParty = new Set();
  for (const options of list) {
    if (typeof options?.id === "string" && builtinIds.has(options.id)) {
      switches.set(options.id, options);
    } else {
      if (options && typeof options === "object" && options.disabled !== true && Array.isArray(options.replaces)) {
        for (const svc of options.replaces) {
          if (typeof svc === "string") replacedByThirdParty.add(svc);
        }
      }
      rest.push(...thirdParty(options, builtinIds, warn, false));
    }
  }
  const merged = builtins.map((builtin) => {
    const entry = { ...builtin };
    const written = switches.get(builtin.id);
    for (const key of FILE_KEYS) if (written && written[key] !== undefined) entry[key] = written[key];
    const builtinProvides = builtin[SOURCE]?.provides ?? [];
    const autoDisabled = builtinProvides.filter((svc) => replacedByThirdParty.has(svc));
    if (autoDisabled.length > 0) {
      const existing = Array.isArray(entry.disabledServices) ? entry.disabledServices : [];
      entry.disabledServices = [...new Set([...existing, ...autoDisabled])];
    }
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
