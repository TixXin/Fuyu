var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { Service } from "cordis";
import { AsyncLocalStorage } from "node:async_hooks";
import { realpathSync as realpathSync2 } from "node:fs";
import { basename as basename3, dirname as dirname3, isAbsolute, relative, resolve as resolve3, sep as sep2 } from "node:path";

// src/error.ts
import { codeFrameColumns } from "@babel/code-frame";
import { readFileSync } from "node:fs";
function isBuildFailure(e) {
  return Array.isArray(e?.errors) && e.errors.length > 0 && e.errors.every((error) => error?.text);
}
__name(isBuildFailure, "isBuildFailure");
function handleError(ctx, e) {
  if (!isBuildFailure(e)) {
    ctx.logger.warn(e);
    return;
  }
  for (const error of e.errors) {
    if (!error.location) {
      ctx.logger.warn(error.text);
      continue;
    }
    try {
      const { file, line, column } = error.location;
      const source = readFileSync(file, "utf8");
      const formatted = codeFrameColumns(source, {
        start: { line, column }
      }, {
        highlightCode: true,
        message: error.text
      });
      ctx.logger.warn(`File: ${file}:${line}:${column}
` + formatted);
    } catch (e2) {
      ctx.logger.warn(e2);
    }
  }
}
__name(handleError, "handleError");

// src/runtime/internal.ts
import { createRequire } from "node:module";
function getModuleJobs(loadCache, url) {
  const entry = Map.prototype.get.call(loadCache, url);
  return Object.values(entry ?? {}).filter(Boolean);
}
__name(getModuleJobs, "getModuleJobs");
function requireInternal(id) {
  const require2 = createRequire(import.meta.url);
  if (process.execArgv.includes("--expose-internals")) {
    try {
      return require2(id);
    } catch {
    }
  }
  try {
    return require2("node-addon-require-builtin").requireBuiltin(id);
  } catch {
  }
}
__name(requireInternal, "requireInternal");
function internalBinding(id) {
  const realm = requireInternal("internal/bootstrap/realm");
  if (realm) return realm.internalBinding(id);
  const { emitWarning } = process;
  process.emitWarning = function(...args) {
    const type = typeof args[1] === "string" ? args[1] : args[1]?.type;
    if (type !== "internal/test/binding") return emitWarning.apply(this, args);
  };
  try {
    return requireInternal("internal/test/binding")?.internalBinding(id);
  } catch {
  } finally {
    process.emitWarning = emitWarning;
  }
}
__name(internalBinding, "internalBinding");
var ModuleLoader;
((ModuleLoader3) => {
  let _cachedLoader;
  function fromInternal() {
    if (_cachedLoader) return _cachedLoader;
    const [major] = process.versions.node.split(".").map(Number);
    if (major < 22) return;
    const raw = requireInternal("internal/modules/esm/loader")?.getOrInitializeCascadedLoader();
    if (!raw) return;
    const version = typeof raw.getOrCreateModuleJob === "function" ? "v2" : typeof raw.getModuleJobForImport === "function" ? "v1" : void 0;
    if (!version) return;
    return _cachedLoader = Object.assign(raw, { version });
  }
  ModuleLoader3.fromInternal = fromInternal;
  __name(fromInternal, "fromInternal");
})(ModuleLoader || (ModuleLoader = {}));

// src/runtime/modules.ts
import { createRequire as createRequire2 } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
function isBuiltin(url) {
  return url.startsWith("node:");
}
__name(isBuiltin, "isBuiltin");
function toPath(url) {
  if (url.startsWith("file:")) return fileURLToPath(url);
}
__name(toPath, "toPath");
var ModuleCaches = class {
  constructor(_loader) {
    this._loader = _loader;
  }
  _loader;
  static {
    __name(this, "ModuleCaches");
  }
  _cjs = createRequire2(import.meta.url).cache;
  /** Whether a module is loaded under `url` in either cache. */
  has(url) {
    if (Map.prototype.has.call(this._loader.loadCache, url)) return true;
    const path = toPath(url);
    return !!path && path in this._cjs;
  }
  /** The URLs of the loaded modules, in either cache. */
  urls() {
    const urls = new Set(Map.prototype.keys.call(this._loader.loadCache));
    for (const path of Object.keys(this._cjs)) urls.add(pathToFileURL(path).href);
    return urls;
  }
  /**
   * The namespace of the module job of `url` imported without the `type`
   * attribute, or `undefined` if there is no such job, it has not been
   * instantiated, or its evaluation failed.
   */
  namespace(url) {
    const module = this._loader.loadCache.get(url)?.module;
    if (!module || module.getStatus() === 5 /* Errored */) return;
    try {
      return module.getNamespace();
    } catch {
    }
  }
  /**
   * The exports of the CJS module of `url`, or `undefined` if there is no
   * such module or it has not finished loading.
   */
  exports(url) {
    const path = toPath(url);
    const module = path ? this._cjs[path] : void 0;
    if (module?.loaded) return module.exports;
  }
  /**
   * The direct dependencies of a module: the modules linked by its module
   * jobs in every type slot, and the children of its CJS module. A job that
   * failed to link contributes no dependencies.
   */
  async edges(url) {
    const edges = /* @__PURE__ */ new Set();
    await Promise.all(getModuleJobs(this._loader.loadCache, url).map(async (job) => {
      let linked;
      try {
        linked = Array.from(await job.linked);
      } catch {
        return;
      }
      for (const child of linked) edges.add(child.url);
    }));
    for (const child of this.children(url)) edges.add(child);
    return edges;
  }
  /** The URLs of the children of the CJS module of `url`. */
  children(url) {
    const path = toPath(url);
    return (path && this._cjs[path]?.children || []).map((child) => pathToFileURL(child.filename).href);
  }
  /**
   * Remove the module jobs that failed to load, link or evaluate, each from
   * its own type slot, so that the next import of their modules tries again.
   * Node keeps such a job in the load cache, and every later import of the
   * module throws its error again. A job in progress has not failed and is
   * kept. The CJS module cache is left alone: Node removes a CJS module whose
   * evaluation failed.
   *
   * A job has failed if its module is errored, or if its `modulePromise`,
   * `linked` or `instantiated` promise has been rejected. A promise that has
   * settled runs its handlers before the next macrotask.
   */
  async sweep() {
    const loadCache = this._loader.loadCache;
    const checks = [];
    for (const url of Map.prototype.keys.call(loadCache)) {
      if (isBuiltin(url)) continue;
      const entry = Map.prototype.get.call(loadCache, url);
      for (const type in entry) {
        const job = entry[type];
        if (!job) continue;
        const check = { url, entry, type, job, failed: job.module?.getStatus() === 5 /* Errored */ };
        for (const promise of [job.modulePromise, job.linked, job.instantiated]) {
          if (!promise || Array.isArray(promise)) continue;
          promise.then(void 0, () => check.failed = true);
        }
        checks.push(check);
      }
    }
    await new Promise((resolve4) => setImmediate(resolve4));
    for (const { url, entry, type, job, failed } of checks) {
      if (!failed || entry[type] !== job) continue;
      delete entry[type];
      if (!Object.values(entry).some(Boolean)) {
        Map.prototype.delete.call(loadCache, url);
      }
    }
  }
  /**
   * Remove modules from both caches, so that their next import evaluates
   * their files again. Existing references keep the old instances.
   * @returns a backup of the removed entries
   */
  evict(urls) {
    const esm = /* @__PURE__ */ new Map();
    const cjs = /* @__PURE__ */ new Map();
    for (const url of urls) {
      const entry = Map.prototype.get.call(this._loader.loadCache, url);
      if (entry) esm.set(url, entry);
      const path = toPath(url);
      if (path && this._cjs[path]) cjs.set(path, this._cjs[path]);
      this._delete(url);
    }
    return {
      restore: /* @__PURE__ */ __name((urls2) => {
        for (const url of urls2) {
          this._delete(url);
          if (esm.has(url)) Map.prototype.set.call(this._loader.loadCache, url, esm.get(url));
          const path = toPath(url);
          if (path && cjs.has(path)) this._cjs[path] = cjs.get(path);
        }
      }, "restore")
    };
  }
  _delete(url) {
    Map.prototype.delete.call(this._loader.loadCache, url);
    const path = toPath(url);
    if (path) delete this._cjs[path];
  }
};

// src/runtime/patches.ts
import { isUtf8 } from "node:buffer";
import { readFileSync as readFileSync2, realpathSync } from "node:fs";
import Module, { isBuiltin as isBuiltin2 } from "node:module";
import { basename, dirname, join, parse, resolve, sep, toNamespacedPath } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var key = /* @__PURE__ */ Symbol.for("cordis.hmr.patches");
var current;
function activate() {
  const previous = globalThis[key];
  if (previous?.active) {
    throw new Error("another HMR instance is active in this thread");
  }
  const paths = new Set(previous?.paths ?? []);
  if (previous && !previous.dispose()) {
    throw new Error("the methods replaced by an earlier HMR cannot be restored, restart the process to use this one");
  }
  const installed = setup(paths);
  const patches = installed ? { active: true, paths: installed.state.paths, dispose: installed.dispose } : { active: true, paths, dispose: /* @__PURE__ */ __name(() => true, "dispose") };
  globalThis[key] = patches;
  current = installed?.state;
  return () => {
    patches.active = false;
    current = void 0;
  };
}
__name(activate, "activate");
var kDefer = /* @__PURE__ */ Symbol("defer");
function invalidateManifests(paths) {
  if (!current) return;
  for (const path of paths) current.paths.add(resolve(path));
  current.cache.clear();
  current.directories.clear();
}
__name(invalidateManifests, "invalidateManifests");
function setup(paths) {
  const binding = internalBinding("modules");
  const reader = requireInternal("internal/modules/package_json_reader");
  if (typeof binding?.readPackageJSON !== "function") return;
  if (typeof binding.getPackageScopeConfig !== "function") return;
  if (typeof reader?.getNearestParentPackageJSON !== "function") return;
  const resolveForCJSWithHooks = requireInternal("internal/modules/cjs/loader")?.resolveForCJSWithHooks;
  const hooks = requireInternal("internal/modules/customization_hooks")?.resolveHooks;
  const resolveHooks = Array.isArray(hooks) ? hooks : void 0;
  const state = { paths, cache: /* @__PURE__ */ new Map(), directories: /* @__PURE__ */ new Map() };
  const original = {
    readPackageJSON: binding.readPackageJSON,
    getNearestParentPackageJSON: binding.getNearestParentPackageJSON,
    getPackageScopeConfig: binding.getPackageScopeConfig,
    getPackageType: binding.getPackageType,
    reader: reader.getNearestParentPackageJSON,
    load: Module._load
  };
  const absent = original.reader(join(parse(process.cwd()).root, "node_modules", "package.json")) !== void 0;
  const readPackageJSON = /* @__PURE__ */ __name((path, isESM, base, specifier) => {
    return isInvalidated(state, path) ? read(state, path, isESM ? { base, specifier } : void 0) : original.readPackageJSON(path, isESM, base, specifier);
  }, "readPackageJSON");
  const find = /* @__PURE__ */ __name((manifests, specifier) => {
    const invalidated = manifests.map((path) => isInvalidated(state, path));
    if (!invalidated.includes(true)) return kDefer;
    for (const [index, path] of manifests.entries()) {
      const manifest = invalidated[index] ? read(state, path, specifier === void 0 ? void 0 : { specifier }) : specifier === void 0 ? original.readPackageJSON(path) : original.readPackageJSON(path, true, void 0, specifier);
      if (manifest) return manifest;
    }
  }, "find");
  const getNearestParentPackageJSON = /* @__PURE__ */ __name((checkPath) => {
    const manifest = find(nearest(checkPath));
    return manifest === kDefer ? original.getNearestParentPackageJSON(checkPath) : manifest;
  }, "getNearestParentPackageJSON");
  const getPackageScopeConfig = /* @__PURE__ */ __name((url) => {
    if (!url.startsWith("file:")) return original.getPackageScopeConfig(url);
    const { manifests, last } = scope(url);
    const manifest = find(manifests, url);
    return manifest === kDefer ? original.getPackageScopeConfig(url) : manifest ?? last;
  }, "getPackageScopeConfig");
  const getPackageType = /* @__PURE__ */ __name((url) => {
    if (!url.startsWith("file:")) return original.getPackageType(url);
    const manifest = find(scope(url).manifests, url);
    return manifest === kDefer ? original.getPackageType(url) : manifest?.[2];
  }, "getPackageType");
  const getNearestParentPackageJSONFromReader = /* @__PURE__ */ __name((checkPath) => {
    const manifest = find(nearest(checkPath));
    if (manifest === kDefer) return original.reader(checkPath);
    if (manifest) return deserialize(manifest);
    if (absent) return { data: { __proto__: null, type: "none" }, exists: false, path: checkPath };
  }, "getNearestParentPackageJSONFromReader");
  const loadAs = /* @__PURE__ */ __name(function(key2, result, parent, isMain, args) {
    const { url, format, parentURL } = result;
    const hook = {
      resolve: /* @__PURE__ */ __name((specifier, context, next) => specifier === key2 && context.parentURL === parentURL ? { url, format, shortCircuit: true } : next(specifier, context), "resolve")
    };
    resolveHooks.push(hook);
    try {
      return original.load.call(this, key2, parent, isMain, ...args);
    } finally {
      const index = resolveHooks.lastIndexOf(hook);
      if (index !== -1) resolveHooks.splice(index, 1);
    }
  }, "loadAs");
  const loadAsFile = /* @__PURE__ */ __name(function(key2, filename, parent, isMain, args) {
    const resolveFilename = Module._resolveFilename;
    let active = true;
    const replacement = /* @__PURE__ */ __name(function(request, ...rest) {
      return active && request === key2 ? filename : resolveFilename.call(this, request, ...rest);
    }, "replacement");
    Module._resolveFilename = replacement;
    try {
      return original.load.call(this, key2, parent, isMain, ...args);
    } finally {
      active = false;
      if (Module._resolveFilename === replacement) Module._resolveFilename = resolveFilename;
    }
  }, "loadAsFile");
  const inBucket = /* @__PURE__ */ __name((parent, load2) => {
    const descriptor = Object.getOwnPropertyDescriptor(parent, "path");
    if (!descriptor?.configurable || !("value" in descriptor)) return load2();
    let restored = false;
    const restore = /* @__PURE__ */ __name(() => {
      if (restored) return;
      restored = true;
      Object.defineProperty(parent, "path", descriptor);
    }, "restore");
    Object.defineProperty(parent, "path", { configurable: true, get: /* @__PURE__ */ __name(() => (restore(), `\0${descriptor.value}`), "get") });
    try {
      return load2();
    } finally {
      restore();
    }
  }, "inBucket");
  const load = /* @__PURE__ */ __name(function(request, parent, isMain, ...args) {
    if (!parent) return original.load.call(this, request, parent, isMain, ...args);
    const result = resolveForCJSWithHooks ? resolveForCJSWithHooks(request, parent, isMain, args[0] ?? {}) : { filename: Module._resolveFilename(request, parent, isMain) };
    const target = result.url ?? result.filename;
    const hooked = !!resolveHooks?.length;
    const builtin = isBuiltin2(target) ? target.replace(/^node:/, "") : void 0;
    if (builtin !== void 0 && target.startsWith("node:") && (request === target || !isBuiltin2(builtin))) {
      return inBucket(parent, () => hooked ? loadAs.call(this, target, result, parent, isMain, args) : original.load.call(this, target, parent, isMain, ...args));
    }
    const key2 = `\0${target}`;
    return hooked ? loadAs.call(this, key2, result, parent, isMain, args) : loadAsFile.call(this, key2, builtin ?? result.filename, parent, isMain, args);
  }, "load");
  const restores = [];
  const dispose = /* @__PURE__ */ __name(() => [...restores].reverse().map((restore) => restore()).every(Boolean), "dispose");
  try {
    install(restores, binding, "readPackageJSON", readPackageJSON);
    if (original.getNearestParentPackageJSON) install(restores, binding, "getNearestParentPackageJSON", getNearestParentPackageJSON);
    install(restores, binding, "getPackageScopeConfig", getPackageScopeConfig);
    if (original.getPackageType) install(restores, binding, "getPackageType", getPackageType);
    install(restores, reader, "getNearestParentPackageJSON", getNearestParentPackageJSONFromReader);
    install(restores, Module, "_load", load);
  } catch {
    dispose();
    return;
  }
  return { state, dispose };
}
__name(setup, "setup");
function install(restores, target, key2, replacement) {
  const original = target[key2];
  target[key2] = replacement;
  restores.push(() => {
    if (target[key2] !== replacement) return false;
    target[key2] = original;
    return true;
  });
}
__name(install, "install");
function isInvalidated(state, manifest) {
  if (within(state, manifest)) return true;
  const directory = dirname(manifest);
  let real = state.directories.get(directory);
  if (real === void 0) {
    try {
      real = realpathSync(directory);
    } catch {
      real = directory;
    }
    state.directories.set(directory, real);
  }
  return real !== directory && within(state, join(real, basename(manifest)));
}
__name(isInvalidated, "isInvalidated");
function within(state, path) {
  while (true) {
    if (state.paths.has(path)) return true;
    const parent = dirname(path);
    if (parent === path) return false;
    path = parent;
  }
}
__name(within, "within");
function nearest(checkPath) {
  const manifests = [];
  let directory = checkPath.endsWith(sep) ? checkPath.slice(0, -1) : dirname(checkPath);
  while (dirname(directory) !== directory && basename(directory) !== "node_modules") {
    manifests.push(join(directory, "package.json"));
    directory = dirname(directory);
  }
  return manifests;
}
__name(nearest, "nearest");
function scope(url) {
  const manifests = [];
  let current2 = new URL("./package.json", url);
  while (!current2.pathname.endsWith("/node_modules/package.json")) {
    manifests.push(fileURLToPath2(current2));
    const next = new URL("../package.json", current2);
    if (next.pathname === current2.pathname) break;
    current2 = next;
  }
  return { manifests, last: fileURLToPath2(current2) };
}
__name(scope, "scope");
function read(state, path, context) {
  const cached = state.cache.get(path);
  if (cached !== void 0) return cached ?? void 0;
  const manifest = parseManifest(path, context);
  state.cache.set(path, manifest ?? null);
  return manifest;
}
__name(read, "read");
function parseManifest(path, context) {
  let buffer;
  try {
    buffer = readFileSync2(path);
  } catch {
    return;
  }
  const fail = /* @__PURE__ */ __name(() => {
    let message = `Invalid package config ${toNamespacedPath(path)}`;
    if (context?.base !== void 0) {
      const base = context.base.startsWith("file:") ? fileURLToPath2(context.base) : context.base;
      message += ` while importing "${context.specifier}" from ${base}`;
    }
    throw Object.assign(new Error(message + "."), { code: "ERR_INVALID_PACKAGE_CONFIG" });
  }, "fail");
  if (!isUtf8(buffer)) fail();
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 65279) text = text.slice(1);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail();
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) fail();
  const isString = /* @__PURE__ */ __name((value) => typeof value === "string" && value.isWellFormed(), "isString");
  if ("name" in json && !isString(json.name)) fail();
  if ("type" in json && !isString(json.type)) fail();
  const field = /* @__PURE__ */ __name((value) => {
    if (typeof value === "string") return isString(value) ? value : fail();
    if (value && typeof value === "object") return JSON.stringify(value);
  }, "field");
  return [
    json.name,
    isString(json.main) ? json.main : void 0,
    json.type === "commonjs" || json.type === "module" ? json.type : "none",
    field(json.imports),
    field(json.exports),
    toNamespacedPath(path)
  ];
}
__name(parseManifest, "parseManifest");
function deserialize([name, main, type, imports, exports, path]) {
  const parse2 = /* @__PURE__ */ __name((value) => value?.[0] === "[" || value?.[0] === "{" ? JSON.parse(value) : value, "parse");
  return {
    data: {
      __proto__: null,
      ...name !== void 0 && { name },
      ...main !== void 0 && { main },
      type,
      exports: parse2(exports),
      imports: parse2(imports)
    },
    exists: true,
    path
  };
}
__name(deserialize, "deserialize");

// src/runtime/resolution.ts
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import Module2 from "node:module";
import { basename as basename2, dirname as dirname2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath3, pathToFileURL as pathToFileURL2 } from "node:url";
var captured;
function getCaptured() {
  if (captured) return captured;
  const loader = ModuleLoader.fromInternal();
  if (!loader) return;
  const result = capture(loader);
  if (result.complete) captured = result.captured;
  return result.captured;
}
__name(getCaptured, "getCaptured");
function invalidateResolution(paths) {
  const list = [...paths];
  if (!list.length) return [];
  const pathCache = Module2._pathCache;
  for (const key2 in pathCache) delete pathCache[key2];
  invalidateManifests(list);
  const captured2 = getCaptured();
  if (!captured2) return [];
  const { resolve: resolve4, realpath } = captured2;
  for (const cache of /* @__PURE__ */ new Set([realpath.esm, realpath.cjs])) {
    if (cache) Map.prototype.clear.call(cache);
  }
  return resolve4 ? removeResolutions(resolve4, list) : [];
}
__name(invalidateResolution, "invalidateResolution");
function removeResolutions(cache, paths) {
  const roots = /* @__PURE__ */ new Set();
  const locations = /* @__PURE__ */ new Map();
  for (let path of paths) {
    path = resolve2(path);
    if (basename2(path) === "package.json") path = dirname2(path);
    roots.add(path);
    const location = locatePackage(path);
    if (!location) continue;
    let dirs = locations.get(location.name);
    if (!dirs) locations.set(location.name, dirs = /* @__PURE__ */ new Set());
    dirs.add(location.dir);
  }
  const affects = /* @__PURE__ */ __name((parentURL, request, url) => {
    if (typeof url !== "string" || within2(roots, toPath2(url))) return true;
    const parent = typeof parentURL === "string" ? toPath2(parentURL) : void 0;
    if (within2(roots, parent)) return true;
    const dirs = request && locations.get(packageName(request.specifier));
    return !!dirs && within2(dirs, parent);
  }, "affects");
  const removed = [];
  for (const [parentURL, imports] of [...Map.prototype.entries.call(cache)]) {
    for (const key2 of Object.keys(imports)) {
      const url = imports[key2]?.url;
      const request = parseKey(key2);
      if (!affects(parentURL, request, url)) continue;
      const result = imports[key2];
      delete imports[key2];
      if (request && typeof url === "string" && typeof parentURL === "string") {
        removed.push({ ...request, parentURL, url, key: key2, result });
      }
    }
  }
  return removed;
}
__name(removeResolutions, "removeResolutions");
function restoreResolutions(resolutions) {
  const cache = getCaptured()?.resolve;
  if (!cache) return;
  for (const { parentURL, key: key2, result } of resolutions) {
    let imports = Map.prototype.get.call(cache, parentURL);
    if (!imports) Map.prototype.set.call(cache, parentURL, imports = { __proto__: null });
    imports[key2] = result;
  }
}
__name(restoreResolutions, "restoreResolutions");
function parseKey(key2) {
  const pair = /"(?:[^"\\]|\\.)*""(?:[^"\\]|\\.)*"/;
  const format = new RegExp(`^(?:${pair.source}(?:,${pair.source})*)?$`);
  for (let index = key2.lastIndexOf("::"); index !== -1; index = key2.lastIndexOf("::", index - 1)) {
    const serialized = key2.slice(index + 2);
    if (!format.test(serialized)) continue;
    const attributes = {};
    for (const [, name, value] of serialized.matchAll(/("(?:[^"\\]|\\.)*")("(?:[^"\\]|\\.)*")/g)) {
      attributes[JSON.parse(name)] = JSON.parse(value);
    }
    return { specifier: key2.slice(0, index), attributes };
  }
}
__name(parseKey, "parseKey");
function locatePackage(path) {
  if (basename2(path) === "package.json") path = dirname2(path);
  const scoped = basename2(dirname2(path)).startsWith("@");
  const modules = scoped ? dirname2(dirname2(path)) : dirname2(path);
  if (basename2(modules) !== "node_modules") return;
  const name = scoped ? `${basename2(dirname2(path))}/${basename2(path)}` : basename2(path);
  return { name, dir: dirname2(modules) };
}
__name(locatePackage, "locatePackage");
function packageName(specifier) {
  if (/^(?:[./#]|[a-z][a-z\d+.-]*:)/i.test(specifier)) return;
  const [scope2, name] = specifier.split("/", 2);
  return scope2.startsWith("@") ? name && `${scope2}/${name}` : scope2;
}
__name(packageName, "packageName");
function toPath2(url) {
  if (!url.startsWith("file:")) return;
  try {
    return fileURLToPath3(url);
  } catch {
  }
}
__name(toPath2, "toPath");
function within2(roots, path) {
  while (path) {
    if (roots.has(path)) return true;
    const parent = dirname2(path);
    if (parent === path) return false;
    path = parent;
  }
  return false;
}
__name(within2, "within");
function resolveRequest(loader, { specifier, attributes, parentURL }) {
  return loader.version === "v2" ? loader.resolveSync(parentURL, { specifier, attributes }).url : loader.resolveSync(specifier, parentURL, attributes).url;
}
__name(resolveRequest, "resolveRequest");
function capture(loader) {
  const captured2 = { realpath: {} };
  const key2 = requireInternal("internal/fs/utils")?.realpathCacheKey;
  const { realpathSync: realpathSync3 } = fs;
  let realpathCache;
  fs.realpathSync = Object.assign(function(...args) {
    const options = args[1];
    if (key2 && options?.[key2]) realpathCache ??= options[key2];
    return realpathSync3.apply(this, args);
  }, { native: realpathSync3.native });
  try {
    const esm = captureESM(loader);
    captured2.resolve = esm.resolveCache;
    captured2.realpath.esm = realpathCache;
    realpathCache = void 0;
    const cjs = captureCJS();
    captured2.realpath.cjs = realpathCache;
    return { captured: captured2, complete: esm.complete && cjs };
  } finally {
    fs.realpathSync = realpathSync3;
  }
}
__name(capture, "capture");
function captureESM(loader) {
  const prototype = requireInternal("internal/modules/esm/module_map")?.ResolveCache?.prototype;
  if (typeof prototype?.get !== "function") return { complete: true };
  const { get } = prototype;
  const hooks = requireInternal("internal/modules/customization_hooks")?.resolveHooks;
  const registered = Array.isArray(hooks) ? hooks.splice(0) : [];
  let resolveCache;
  prototype.get = function(...args) {
    resolveCache ??= this;
    return get.apply(this, args);
  };
  const specifier = `${pathToFileURL2(process.execPath).href}?cordis-hmr-capture=${randomUUID()}`;
  let complete = true;
  try {
    if (loader.version === "v2") {
      loader.resolveSync(specifier, { specifier, attributes: {} });
    } else {
      loader.resolveSync(specifier, specifier, {});
    }
  } catch {
    complete = false;
  } finally {
    prototype.get = get;
    hooks?.unshift(...registered);
  }
  return { resolveCache, complete };
}
__name(captureESM, "captureESM");
function captureCJS() {
  const pathCache = Module2._pathCache;
  Module2._pathCache = { __proto__: null };
  try {
    return !!Module2._findPath(process.execPath, null, false);
  } catch {
    return false;
  } finally {
    Module2._pathCache = pathCache;
  }
}
__name(captureCJS, "captureCJS");

// src/index.ts
import { fileURLToPath as fileURLToPath4, pathToFileURL as pathToFileURL3 } from "node:url";
import z from "schemastery";
var scheme = /^[a-z][a-z\d+.-]*:/i;
var driveLetter = /^[A-Za-z]:[\\/]/;
function isBuiltin3(url) {
  return url.startsWith("node:");
}
__name(isBuiltin3, "isBuiltin");
function isNativeAddon(url) {
  return url.startsWith("file:") && url.endsWith(".node");
}
__name(isNativeAddon, "isNativeAddon");
async function closure(roots, edges, stop = () => false) {
  const result = /* @__PURE__ */ new Set();
  const traverse = /* @__PURE__ */ __name(async (url) => {
    if (result.has(url) || isBuiltin3(url) || stop(url)) return;
    result.add(url);
    await Promise.all([...await edges(url)].map(traverse));
  }, "traverse");
  await Promise.all([...roots].map(traverse));
  return result;
}
__name(closure, "closure");
var SkipError = class extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
  reason;
  static {
    __name(this, "SkipError");
  }
};
function isRequest({ specifier }) {
  return !isAbsolute(specifier) && !scheme.test(specifier);
}
__name(isRequest, "isRequest");
function contains(dir, path) {
  return path === dir || path.startsWith(dir.endsWith(sep2) ? dir : dir + sep2);
}
__name(contains, "contains");
function covers(root, path) {
  if (basename3(root) === "package.json") root = dirname3(root);
  if (contains(root, path)) return true;
  const location = locatePackage(root);
  return !!location && contains(location.dir, path);
}
__name(covers, "covers");
function unwrapExports(exports) {
  if (exports === null || exports === void 0) return exports;
  exports = exports.default ?? exports;
  if (!exports.__esModule) return exports;
  return exports.default ?? exports;
}
__name(unwrapExports, "unwrapExports");
function toPath3(url) {
  if (url.startsWith("file:")) return fileURLToPath4(url);
}
__name(toPath3, "toPath");
var Hmr = class _Hmr extends Service {
  constructor(ctx, config) {
    super(ctx, "hmr");
    this.config = config;
    const loader = ModuleLoader.fromInternal();
    if (!loader) {
      throw new Error("loader internals are unavailable, pass --expose-internals or install node-addon-require-builtin");
    }
    this._loader = loader;
    this._modules = new ModuleCaches(loader);
    ctx.effect(() => activate());
    this.baseDir = process.platform === "win32" && config.base && driveLetter.test(config.base) ? fileURLToPath4(pathToFileURL3(config.base)) : ctx.baseUrl || config.base?.startsWith("file:") ? fileURLToPath4(new URL(config.base || ".", ctx.baseUrl)) : resolve3(config.base || ".");
    ctx.inject(["fs"], (ctx2) => this._watch(ctx2));
  }
  config;
  static {
    __name(this, "Hmr");
  }
  /** The resolved `base`. `watch.files` and logged paths are relative to it. */
  baseDir;
  /** Node's internal ESM loader. */
  _loader;
  /** Node's module caches. */
  _modules;
  /**
   * The dependency tree of the main entry point. A change to any of these
   * modules can only be applied by restarting the process.
   */
  hostModules = /* @__PURE__ */ new Set();
  /** The tail of the transaction queue. */
  _queue = Promise.resolve();
  /** The running transaction, matched against the async context of a call. */
  _current;
  _storage = new AsyncLocalStorage();
  /**
   * Reconcile the changes collected over each debounce window. Skipped
   * changes are reported, since restarting is up to the host. The files that
   * concern an aborted unit are retried with the next batch.
   */
  _watch(ctx) {
    const { enabled, files, debounce } = this.config.watch;
    if (!enabled || !files.length) return;
    if (!this.config.base) {
      this.ctx.logger.info("watching %o", files);
    } else {
      this.ctx.logger.info("watching %o in %s", files, this.baseDir);
    }
    const stashed = /* @__PURE__ */ new Set();
    const retained = /* @__PURE__ */ new Set();
    let timer;
    ctx.effect(() => () => clearTimeout(timer));
    let flushing = Promise.resolve();
    const flush = /* @__PURE__ */ __name(async () => {
      if (!stashed.size) return;
      const files2 = /* @__PURE__ */ new Set([...retained, ...stashed]);
      retained.clear();
      stashed.clear();
      try {
        const result = await this.reconcile(() => files2);
        if (result.skipped.length) {
          this.ctx.logger.warn([
            "skipped changes, which apply after a restart:",
            ...result.skipped.flatMap(({ urls, reason }) => urls.map((url) => `- ${this._relative(url)} (${reason})`))
          ].join("\n"));
        }
        const paths = result.aborted.flatMap(({ urls }) => urls.flatMap((url) => toPath3(url) ?? []));
        for (const file of files2) {
          if (paths.some((path) => covers(file, path))) retained.add(file);
        }
      } catch (error) {
        this.ctx.logger.warn(error);
        for (const path of files2) retained.add(path);
      }
    }, "flush");
    ctx.fs.watch(pathToFileURL3(this.baseDir), { filter: files }).on("change", (url) => {
      const filename = fileURLToPath4(url);
      this.ctx.logger.debug("change detected at %C", relative(this.baseDir, filename));
      stashed.add(filename);
      clearTimeout(timer);
      timer = setTimeout(() => flushing = flushing.then(flush), debounce);
    });
  }
  async *[Service.init]() {
    if (process.argv[1]) {
      let main = resolve3(process.argv[1]);
      try {
        main = realpathSync2(main);
      } catch {
      }
      const mainUrl = pathToFileURL3(main).href;
      if (this._modules.has(mainUrl)) {
        this.hostModules = await closure([mainUrl], (url) => this._modules.edges(url));
      }
    }
  }
  /**
   * Run `callback` as the body of a transaction, and replace the components
   * affected by the roots that it resolves to. Transactions run one at a
   * time; one started from within the running transaction, including from
   * `callback`, is rejected. If `callback` throws, the transaction rejects
   * with its error and the module caches are left as they are.
   *
   * A root is an absolute path of a file or a directory:
   * - the loaded modules whose files are the root or lie below it are
   *   changed. Module URLs are real paths, so the caller passes the real path
   *   under which modules were loaded, such as the previous target of a link;
   * - later resolutions observe the file system below it. For a package, the
   *   caller also passes its location, such as a link or a directory where a
   *   package is added, since Node resolves package names through it.
   *
   * A component whose module is no longer where the import that loaded it now
   * resolves, e.g. after its package exports another entry or a link is
   * retargeted, is replaced from the module that the import resolves to. A
   * changed module that no component depends on is evicted too: its next import
   * gets the new code, while existing references keep the old one.
   *
   * Every transaction first removes the module jobs that failed to load, link
   * or evaluate, whether or not their files changed, so that the next import
   * of their modules tries again.
   */
  reconcile(callback) {
    const current2 = this._storage.getStore();
    if (current2 && current2 === this._current) {
      return Promise.reject(new Error("cannot start a transaction inside another transaction"));
    }
    const task = this._queue.then(() => {
      const id = /* @__PURE__ */ Symbol("transaction");
      this._current = id;
      return this._storage.run(id, () => this._reconcile(callback)).finally(() => {
        this._current = void 0;
      });
    });
    this._queue = task.then(() => {
    }, () => {
    });
    return task;
  }
  _relative(url) {
    if (!url.startsWith("file:")) return url;
    return relative(this.baseDir, fileURLToPath4(url));
  }
  /**
   * Classify the loaded modules into accepted (evicted from the module cache)
   * and declined (kept). The changed modules are accepted, and so is every
   * module that imports an accepted one. This does not depend on whether a
   * registered component uses them, so that a later import, such as by a component
   * that is enabled again, gets the new code. Host modules are declined.
   *
   * The returned `edges` are the dependencies of each loaded module before
   * the eviction, i.e. the old module graph.
   */
  async _analyze(changed) {
    const caches = this._modules;
    const urls = [...caches.urls()].filter((url) => !isBuiltin3(url));
    const edges = /* @__PURE__ */ new Map();
    await Promise.all(urls.map(async (url) => edges.set(url, await caches.edges(url))));
    const importers = /* @__PURE__ */ new Map();
    for (const [url, children] of edges) {
      if (this.hostModules.has(url)) continue;
      for (const child of children) {
        let list = importers.get(child);
        if (!list) importers.set(child, list = []);
        list.push(url);
      }
    }
    const accepted = /* @__PURE__ */ new Set();
    const queue = [...changed];
    while (queue.length) {
      const url = queue.pop();
      if (accepted.has(url)) continue;
      accepted.add(url);
      queue.push(...importers.get(url) ?? []);
    }
    const declined = new Set(this.hostModules);
    for (const url of urls) {
      if (!accepted.has(url)) declined.add(url);
    }
    return { accepted, declined, edges };
  }
  /**
   * Partition the attempts into units: the connected components of the
   * relation in which two components are related if their closures, in the old
   * or the new module graph, share an evicted module.
   *
   * @param edges the dependencies of a module in the new module graph
   * @param retained the modules kept in the caches through the eviction,
   * which import no evicted module, so that the traversal stops at them
   */
  async _partition(attempts, evicted, edges, retained) {
    const reaches = await Promise.all(attempts.map((attempt) => {
      return closure([...attempt.stale.urls, ...attempt.imported], edges, (url) => retained.has(url));
    }));
    const parents = attempts.map((_, index) => index);
    const find = /* @__PURE__ */ __name((index) => {
      while (parents[index] !== index) index = parents[index] = parents[parents[index]];
      return index;
    }, "find");
    const owners = /* @__PURE__ */ new Map();
    attempts.forEach((attempt, index) => {
      for (const url of [...attempt.stale.modules, ...reaches[index]]) {
        if (!evicted.has(url)) continue;
        const owner = owners.get(url);
        if (owner === void 0) {
          owners.set(url, index);
        } else {
          parents[find(index)] = find(owner);
        }
      }
    });
    const units = /* @__PURE__ */ new Map();
    attempts.forEach((attempt, index) => {
      const root = find(index);
      let unit = units.get(root);
      if (!unit) units.set(root, unit = { attempts: [], modules: /* @__PURE__ */ new Set() });
      unit.attempts.push(attempt);
      for (const url of [...attempt.stale.modules, ...reaches[index]]) {
        if (evicted.has(url)) unit.modules.add(url);
      }
    });
    return [...units.values()];
  }
  /**
   * Find every loaded module that exports a registered component, through its
   * ESM namespace or the exports of its CJS module, so that a component that
   * only `require()` has loaded is found too.
   */
  _discover(declined) {
    const candidates = /* @__PURE__ */ new Map();
    for (const url of this._modules.urls()) {
      if (declined.has(url) || isBuiltin3(url)) continue;
      for (const exports of [() => this._modules.namespace(url), () => this._modules.exports(url)]) {
        let component;
        try {
          component = unwrapExports(exports());
        } catch {
          continue;
        }
        if (!component || !this.ctx.registry.has(component)) continue;
        candidates.set(url, component);
        break;
      }
    }
    return candidates;
  }
  /**
   * Locate a module of a stale component again through the removed resolutions
   * to it, so that a module that has moved, e.g. to a new `exports` target or
   * through a retargeted link, is imported at its new URL. A resolution
   * counts if it records a request and its parent is not evicted, since an
   * evicted parent resolves its imports again by itself:
   * - without one, the module is imported at its URL;
   * - if every request now resolves to one module, it is imported through a
   *   request;
   * - otherwise, the component is skipped as `AmbiguousImport`.
   */
  _locate(url, removed, evicted) {
    const sources = removed.filter((resolution) => {
      return resolution.url === url && !evicted.has(resolution.parentURL) && isRequest(resolution);
    });
    if (!sources.length) return { url };
    const targets = new Set(sources.map((source) => resolveRequest(this._loader, source)));
    if (targets.size > 1) {
      throw new SkipError(_Hmr.SkipReason.AmbiguousImport);
    }
    return { url: [...targets][0], source: sources[0] };
  }
  /**
   * The loaded modules outside `matched` that are changed because a request
   * now resolves elsewhere. For a removed ESM resolution whose request now
   * resolves to another module, or fails:
   * - if its parent links the previous result, the parent is changed, so that
   *   it resolves its imports again;
   * - otherwise the previous result was imported dynamically, such as a
   *   component entry, and is changed itself, so that it is imported again where
   *   the request now leads.
   *
   * CJS records no request. A CJS module below `<dir>` is changed if a root is
   * `<dir>/node_modules/<name>` and a child of the module belongs to a package
   * `<name>` in a `node_modules` above `<dir>`, which the new package may
   * shadow; a module that requested the child otherwise is reloaded needlessly.
   */
  async _moved(roots, matched, removed) {
    const moved = /* @__PURE__ */ new Set();
    for (const resolution of removed) {
      const { parentURL, url } = resolution;
      if (matched.has(parentURL) || matched.has(url) || !this._modules.has(url)) continue;
      const links = (await this._modules.edges(parentURL)).has(url);
      if (!links && !isRequest(resolution)) continue;
      let target;
      try {
        target = resolveRequest(this._loader, resolution);
      } catch {
      }
      if (target !== url) moved.add(links ? parentURL : url);
    }
    const locations = [...roots].flatMap((root) => locatePackage(root) ?? []);
    if (!locations.length) return moved;
    for (const url of this._modules.urls()) {
      const path = toPath3(url);
      if (!path) continue;
      for (const { name, dir } of locations) {
        if (!contains(dir, path)) continue;
        const marker = `${sep2}node_modules${sep2}${name.split("/").join(sep2)}${sep2}`;
        const shadows = this._modules.children(url).some((child) => {
          const childPath = toPath3(child);
          const index = childPath?.lastIndexOf(marker) ?? -1;
          if (index === -1) return false;
          const above = childPath.slice(0, index);
          return above !== dir && contains(above, dir);
        });
        if (shadows) moved.add(url);
      }
    }
    return moved;
  }
  /**
   * The loaded modules whose files are one of `roots` or lie below one of
   * them. A root that matches no loaded module is logged.
   */
  _match(roots) {
    const matched = /* @__PURE__ */ new Set();
    const used = /* @__PURE__ */ new Set();
    for (const url of this._modules.urls()) {
      let path = toPath3(url);
      if (!path) continue;
      while (true) {
        if (roots.has(path)) {
          matched.add(url);
          used.add(path);
        }
        const parent = dirname3(path);
        if (parent === path) break;
        path = parent;
      }
    }
    for (const root of roots) {
      if (!used.has(root)) this.ctx.logger.debug("skip %C (no loaded module)", relative(this.baseDir, root));
    }
    return matched;
  }
  async _reconcile(callback) {
    const result = { settled: [], aborted: [], skipped: [] };
    const roots = /* @__PURE__ */ new Set();
    for (const root of await callback()) {
      if (typeof root !== "string" || !isAbsolute(root)) {
        throw new TypeError(`invalid root ${JSON.stringify(root)}, expected an absolute path`);
      }
      roots.add(resolve3(root));
    }
    const caches = this._modules;
    await caches.sweep();
    if (!roots.size) return result;
    const removed = invalidateResolution(roots);
    const matched = this._match(roots);
    const changed = /* @__PURE__ */ new Set();
    for (const url of /* @__PURE__ */ new Set([...matched, ...await this._moved(roots, matched, removed)])) {
      if (this.hostModules.has(url)) {
        result.skipped.push({ urls: [url], reason: _Hmr.SkipReason.HostModule });
      } else if (isNativeAddon(url)) {
        result.skipped.push({ urls: [url], reason: _Hmr.SkipReason.NativeAddon });
      } else {
        changed.add(url);
      }
    }
    if (!changed.size) return result;
    const { accepted, declined, edges } = await this._analyze(changed);
    const oldEdges = /* @__PURE__ */ __name((url) => edges.get(url) ?? [], "oldEdges");
    const exporters = /* @__PURE__ */ new Map();
    for (const [url, component] of this._discover(declined)) {
      const runtime = this.ctx.registry.get(component);
      let exported = exporters.get(runtime);
      if (!exported) exporters.set(runtime, exported = /* @__PURE__ */ new Map());
      exported.set(url, component);
    }
    const staleComponents = [];
    const evicted = new Set(accepted);
    const owned = /* @__PURE__ */ new Set();
    for (const exported of exporters.values()) {
      const urls = [...exported.keys()];
      const own = new Set(urls);
      const stop = /* @__PURE__ */ __name((url2) => declined.has(url2) && !own.has(url2), "stop");
      const closures = /* @__PURE__ */ new Map();
      for (const url2 of urls) {
        closures.set(url2, await closure([url2], oldEdges, stop));
      }
      const modules = new Set([...closures.values()].flatMap((closure2) => [...closure2]));
      if (![...modules].some((url2) => accepted.has(url2))) continue;
      for (const url2 of modules) {
        evicted.add(url2);
        owned.add(url2);
      }
      const outermost = urls.filter((url2) => !urls.some((other) => other !== url2 && closures.get(other).has(url2)));
      const url = outermost[0] ?? urls[0];
      staleComponents.push({
        url,
        component: exported.get(url),
        urls,
        entries: outermost.length ? outermost : [url],
        modules
      });
    }
    for (const url of changed) {
      if (!owned.has(url)) this.ctx.logger.debug("evict %C (no dependent component)", this._relative(url));
    }
    const backup = caches.evict(evicted);
    const retained = caches.urls();
    const attempts = [];
    for (const stale of staleComponents) {
      const before = caches.urls();
      const attempt = { stale, imported: [], loaded: [], failed: false };
      const load = /* @__PURE__ */ __name(async (url) => {
        const { url: target, source } = this._locate(url, removed, evicted);
        attempt.imported.push(target);
        return unwrapExports(await (source ? this._loader.import(source.specifier, source.parentURL, source.attributes) : this._loader.import(url, import.meta.url, {})));
      }, "load");
      try {
        const others = [];
        for (const url of stale.entries) {
          if (url !== stale.url) others.push(await load(url));
        }
        const exports = await load(stale.url);
        if (!this.ctx.registry.resolve(exports)) {
          throw new Error(`invalid component at ${this._relative(stale.url)}, expect function or object with an "apply" method, received ${typeof exports}`);
        }
        if (others.some((other) => other !== exports)) {
          throw new SkipError(_Hmr.SkipReason.AmbiguousExport);
        }
        attempt.replacement = exports;
      } catch (error) {
        if (error instanceof SkipError) {
          attempt.skip = error.reason;
        } else {
          handleError(this.ctx, error);
          attempt.failed = true;
          attempt.error = error;
        }
      }
      for (const url of caches.urls()) {
        if (!before.has(url) && !evicted.has(url)) attempt.loaded.push(url);
      }
      attempts.push(attempt);
    }
    const newGraph = /* @__PURE__ */ new Map();
    const newEdges = /* @__PURE__ */ __name((url) => {
      let edges2 = newGraph.get(url);
      if (!edges2) newGraph.set(url, edges2 = caches.edges(url));
      return edges2;
    }, "newEdges");
    const units = await this._partition(attempts, evicted, newEdges, retained);
    const aborted = units.filter((unit) => unit.attempts.some((attempt) => attempt.failed));
    const skipped = units.filter((unit) => !aborted.includes(unit) && unit.attempts.some((attempt) => attempt.skip));
    const committed = units.filter((unit) => !aborted.includes(unit) && !skipped.includes(unit));
    const kept = [...aborted, ...skipped];
    const unowned = new Set(evicted);
    for (const unit of units) unit.modules.forEach((url) => unowned.delete(url));
    for (const url of unowned) {
      const reached = await closure([url], oldEdges, (url2) => !evicted.has(url2));
      const overlaps = /* @__PURE__ */ __name((unit) => [...unit.modules].some((url2) => reached.has(url2)), "overlaps");
      if (committed.some(overlaps)) continue;
      for (const unit of kept.filter(overlaps)) unit.modules.add(url);
    }
    const restored = new Set(kept.flatMap((unit) => [...unit.modules]));
    for (const url of attempts.flatMap((attempt) => attempt.loaded)) {
      const reached = await closure([url], newEdges, (url2) => retained.has(url2));
      if ([...reached].some((url2) => restored.has(url2))) caches.evict([url]);
    }
    backup.restore(restored);
    const replaced = new Set([...evicted].filter((url) => !restored.has(url)));
    restoreResolutions(removed.filter(({ parentURL, url }) => {
      return (restored.has(url) || restored.has(parentURL)) && !replaced.has(url) && !replaced.has(parentURL);
    }));
    for (const unit of aborted) {
      const failure = unit.attempts.find((attempt) => attempt.failed);
      result.aborted.push({ urls: [...unit.modules], error: failure.error });
    }
    for (const unit of skipped) {
      const skip = unit.attempts.find((attempt) => attempt.skip);
      result.skipped.push({ urls: [...unit.modules], reason: skip.skip });
    }
    const fibers = [];
    const applied = new Set(committed.flatMap((unit) => unit.attempts));
    for (const attempt of attempts) {
      if (!applied.has(attempt)) continue;
      const { url, component } = attempt.stale;
      const path = this._relative(url);
      try {
        const replaced2 = this.ctx.registry.replace(component, attempt.replacement);
        if (!replaced2.length) continue;
        this.ctx.logger.info("reload component at %C", path);
        fibers.push(...replaced2);
      } catch (error) {
        this.ctx.logger.warn("failed to reload component at %C", path);
        this.ctx.logger.warn(error);
      }
    }
    await Promise.all(fibers.map((fiber) => fiber.await().catch(() => {
    })));
    result.settled = fibers.filter((fiber) => fiber.uid !== null);
    return result;
  }
};
((Hmr2) => {
  Hmr2.Config = z.object({
    base: z.string().description("The base directory. Defaults to `ctx.baseUrl`."),
    watch: z.object({
      enabled: z.boolean().default(false).description("Reload on file changes. Requires the `fs` service."),
      files: z.array(String).role("table").default([
        ".",
        "!**/node_modules",
        "!**/.*"
      ]).description("Files to watch, in glob patterns relative to `base`, as `filter` of `ctx.fs.watch()`."),
      debounce: z.natural().role("ms").default(100).description("Debounce changes before reloading, in milliseconds.")
    }).description("Watch")
  });
  let SkipReason;
  ((SkipReason2) => {
    SkipReason2["HostModule"] = "host-module";
    SkipReason2["NativeAddon"] = "native-addon";
    SkipReason2["AmbiguousImport"] = "ambiguous-import";
    SkipReason2["AmbiguousExport"] = "ambiguous-export";
  })(SkipReason = Hmr2.SkipReason || (Hmr2.SkipReason = {}));
})(Hmr || (Hmr = {}));
var index_default = Hmr;
export {
  index_default as default
};
