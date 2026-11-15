import { CODE_EXTENSIONS, readTree } from "./files.mjs";
import { readLockfile } from "./lockfile.mjs";
import { scanCode } from "./scan.mjs";

const DEPENDENCY_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"];
const INSTALL_HOOKS = ["preinstall", "install", "postinstall", "prepare", "prepublish", "preprepare", "postprepare"];

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function readManifest(tree) {
  const entry = tree.files.get("package.json");
  if (!entry?.text) return { manifest: null, error: "missing" };
  try {
    const manifest = JSON.parse(entry.text);
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { manifest: null, error: "not an object" };
    return { manifest, error: null };
  } catch (error) {
    return { manifest: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function manifestFacts(manifest) {
  const fuyu = manifest?.fuyu && typeof manifest.fuyu === "object" ? manifest.fuyu : {};
  const dependencies = {};
  for (const field of DEPENDENCY_FIELDS) {
    const value = manifest?.[field];
    if (value && typeof value === "object") for (const [name, range] of Object.entries(value)) dependencies[`${field}:${name}`] = String(range);
  }
  const scripts = {};
  for (const hook of INSTALL_HOOKS) if (typeof manifest?.scripts?.[hook] === "string") scripts[hook] = manifest.scripts[hook];
  return {
    name: typeof manifest?.name === "string" ? manifest.name : null,
    version: typeof manifest?.version === "string" ? manifest.version : null,
    network: list(fuyu.network).map((host) => host.toLowerCase()),
    provides: list(fuyu.provides),
    replaces: list(fuyu.replaces),
    experimental: list(fuyu.experimental),
    nodeApis: Array.isArray(fuyu.nodeApis) ? list(fuyu.nodeApis) : null,
    dependencies,
    installHooks: scripts,
  };
}

function aggregate(tree, prefix, withObfuscation) {
  const modules = new Map();
  const domains = new Map();
  const sensitive = new Map();
  const obfuscation = [];
  const add = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const file of tree.files.values()) {
    if (!file.text || !CODE_EXTENSIONS.test(file.path)) continue;
    const path = `${prefix}${file.path}`;
    const scan = scanCode(file.text);
    for (const item of scan.modules) add(modules, item.name, { file: path, line: item.line });
    for (const item of scan.domains) add(domains, item.domain, { file: path, line: item.line, concatenated: item.concatenated });
    for (const item of scan.sensitive) add(sensitive, `${item.kind}\u0000${path}`, { ...item, file: path });
    if (withObfuscation) for (const item of scan.obfuscation) obfuscation.push({ ...item, file: path });
  }
  return { modules, domains, sensitive, obfuscation };
}

export function scanVersion(dir, builtDir) {
  const tree = readTree(dir);
  const { manifest, error } = readManifest(tree);
  const source = aggregate(tree, "", true);
  const built = builtDir ? readTree(builtDir) : null;
  const builtScan = built ? aggregate(built, "built:", false) : null;
  const merge = (key) => {
    const map = new Map(source[key]);
    if (builtScan) for (const [k, v] of builtScan[key]) map.set(k, [...(map.get(k) ?? []), ...v]);
    return map;
  };
  return {
    dir,
    tree,
    built,
    manifestError: error,
    facts: manifestFacts(manifest),
    lock: readLockfile(tree),
    modules: merge("modules"),
    domains: merge("domains"),
    sensitive: merge("sensitive"),
    obfuscation: source.obfuscation,
  };
}

export function emptyVersion() {
  const tree = { root: null, files: new Map(), symlinks: [] };
  return {
    dir: null,
    tree,
    built: null,
    manifestError: null,
    facts: manifestFacts(null),
    lock: { file: null, packages: new Map(), error: null },
    modules: new Map(),
    domains: new Map(),
    sensitive: new Map(),
    obfuscation: [],
  };
}
