var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { Context as Context5, FiberState as FiberState2, Service as Service2, ValidationError as ValidationError2 } from "cordis";
import { defineProperty } from "cosmokit";

// src/config/entry.ts
import { Context as Context3, FiberState, Inject, ValidationError } from "cordis";
import { deepEqual, isNullable as isNullable2 } from "cosmokit";

// src/config/tree.ts
import { composeError } from "cordis";
import { isNonNullable } from "cosmokit";
import { fileURLToPath as fileURLToPath2, pathToFileURL as pathToFileURL2 } from "node:url";

// src/config/group.ts
import { Service } from "cordis";
import { isNullable } from "cosmokit";

// src/config/utils.ts
import { valueMap } from "cosmokit";
var WRAPPER = "<cordis:evaluate>";
var wrapperCache;
var wrapper = (ctx, expr) => (wrapperCache ??= new Function("ctx", "expr", `
  with (ctx) {
    return eval(expr)
  }
//# sourceURL=${WRAPPER}`))(ctx, expr);
var counter = 0;
function evaluate(ctx, expr, trace) {
  if (!trace) return wrapper(ctx, expr);
  const marker = `<cordis:expression#${++counter}>`;
  try {
    return wrapper(ctx, `${expr}
//# sourceURL=${marker}`);
  } catch (error) {
    traceEvaluation(error, expr, marker, trace);
    throw error;
  }
}
__name(evaluate, "evaluate");
function interpolate(ctx, value, getTrace, path = []) {
  if (isJsExpr(value)) {
    return evaluate(ctx, value.__jsExpr, getTrace?.(path));
  } else if (!value || typeof value !== "object") {
    return value;
  } else if (Array.isArray(value)) {
    return value.map((item, index) => interpolate(ctx, item, getTrace, [...path, index]));
  } else {
    return valueMap(value, (item, key) => interpolate(ctx, item, getTrace, [...path, key]));
  }
}
__name(interpolate, "interpolate");
var framePattern = /^(\s+at )(?:(.+) \((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))$/;
function parseFrame(line) {
  const match = line.match(framePattern);
  if (!match) return;
  const [, prefix, name, file = match[6], row = match[7], column = match[8]] = match;
  return { prefix, name, file, line: +row, column: +column };
}
__name(parseFrame, "parseFrame");
function toOffset(source, line, column) {
  const pattern = /\r\n?|[\n\u2028\u2029]/g;
  let start = 0;
  for (let i = 1; i < line; i++) {
    if (!pattern.exec(source)) return;
    start = pattern.lastIndex;
  }
  return start + column - 1;
}
__name(toOffset, "toOffset");
function traceEvaluation(error, expr, marker, trace) {
  if (typeof error?.stack !== "string") return;
  const outer2 = trace.getOuterStack();
  const start = trace.locate(expr, 0);
  if (!outer2.length && !start) return;
  const lines = error.stack.split("\n");
  const head = lines.findIndex((line) => parseFrame(line));
  if (head === -1) return;
  let last = -1;
  for (let i = head; i < lines.length; i++) {
    if (parseFrame(lines[i])?.file === marker) last = i;
  }
  const cut = lines.findIndex((line, index) => index >= head && index > last && parseFrame(line)?.file === WRAPPER);
  if (cut === -1) return;
  const frames = lines.slice(head, cut).map((line, index) => {
    const frame = parseFrame(line);
    if (frame?.file !== marker) return line;
    const offset = toOffset(expr, frame.line, frame.column);
    const location = offset === void 0 ? void 0 : trace.locate(expr, offset);
    const where = location ? formatLocation(location) : `${frame.file}:${frame.line}:${frame.column}`;
    const name = head + index === cut - 1 ? trace.label : frame.name === "eval" ? void 0 : frame.name;
    return name ? `${frame.prefix}${name} (${where})` : `${frame.prefix}${where}`;
  });
  if (last !== cut - 1) {
    frames.push(start ? `    at ${trace.label} (${formatLocation(start)})` : `    at ${trace.label}`);
  }
  error.stack = [...lines.slice(0, head), ...frames, ...outer2].join("\n");
}
__name(traceEvaluation, "traceEvaluation");
function isJsExpr(value) {
  return value instanceof Object && typeof value.__jsExpr === "string";
}
__name(isJsExpr, "isJsExpr");
function swap(target, source) {
  for (const key of Reflect.ownKeys(target)) {
    Reflect.deleteProperty(target, key);
  }
  for (const key of Reflect.ownKeys(source || {})) {
    Reflect.defineProperty(target, key, Reflect.getOwnPropertyDescriptor(source, key));
  }
}
__name(swap, "swap");
function formatLocation(location) {
  return `${location.filename}:${location.line}:${location.column}`;
}
__name(formatLocation, "formatLocation");
function formatIssue(message, location, path) {
  const where = [path, location && formatLocation(location)].filter(Boolean).join(", ");
  return where ? `  - ${message} (at ${where})` : `  - ${message}`;
}
__name(formatIssue, "formatIssue");
function formatIssues(title, issues, locate) {
  const lines = issues.map(({ message, path }) => {
    return formatIssue(message, locate?.(path), path.length ? path.map(String).join(".") : void 0);
  });
  return `${title}:
${lines.join("\n")}`;
}
__name(formatIssues, "formatIssues");
function relocate(error, message, frames) {
  error.message = message;
  error.stack = [`${error.name}: ${message}`, ...frames].join("\n");
}
__name(relocate, "relocate");
var EntryValidationError = class extends TypeError {
  constructor(issues) {
    super(formatIssues("invalid entry options", issues));
    this.issues = issues;
  }
  issues;
  static {
    __name(this, "EntryValidationError");
  }
  name = "EntryValidationError";
};
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && !isJsExpr(value);
}
__name(isPlainObject, "isPlainObject");
function validateOptions(options, sep, deep = false) {
  if (!isPlainObject(options)) return [{ message: "entry must be an object", path: [] }];
  const issues = [];
  const check = /* @__PURE__ */ __name((key, expected, valid, required = false) => {
    const value = options[key];
    if (value === void 0 || value === null) {
      if (required) issues.push({ message: `${key} is required`, path: [key] });
    } else if (!valid(value)) {
      issues.push({ message: `${key} must be ${expected}`, path: [key] });
    }
  }, "check");
  check("id", "a string", (value) => typeof value === "string");
  if (typeof options.id === "string" && options.id.includes(sep)) {
    issues.push({ message: `id must not contain "${sep}"`, path: ["id"] });
  }
  check("name", "a string", (value) => typeof value === "string", true);
  check("group", "a boolean", (value) => typeof value === "boolean");
  check("disabled", "a boolean", (value) => typeof value === "boolean" || isJsExpr(value));
  if (options.group === true) check("config", "an array", Array.isArray, true);
  check("inject", "an array or an object", (value) => Array.isArray(value) || isPlainObject(value));
  if (Array.isArray(options.inject)) {
    options.inject.forEach((name, index) => {
      if (typeof name === "string") return;
      issues.push({ message: `inject.${index} must be a string`, path: ["inject", index] });
    });
  }
  check("intercept", "an object", isPlainObject);
  check("isolate", "an object", isPlainObject);
  if (isPlainObject(options.isolate)) {
    for (const [name, label] of Object.entries(options.isolate)) {
      if (label === true || typeof label === "string") continue;
      issues.push({ message: `isolate.${name} must be true or a string`, path: ["isolate", name] });
    }
  }
  if (deep && options.group === true && Array.isArray(options.config)) {
    options.config.forEach((child, index) => {
      for (const { message, path } of validateOptions(child, sep, true)) {
        issues.push({ message, path: ["config", index, ...path] });
      }
    });
  }
  return issues;
}
__name(validateOptions, "validateOptions");

// src/config/group.ts
var EntryGroup = class {
  constructor(ctx, tree) {
    this.ctx = ctx;
    this.tree = tree;
    const entry = ctx.fiber.entry;
    if (entry) entry.subgroup = this;
  }
  ctx;
  tree;
  static {
    __name(this, "EntryGroup");
  }
  static key = /* @__PURE__ */ Symbol.for("cordis.group");
  data = [];
  get context() {
    return this.ctx;
  }
  async create(options) {
    const issues = validateOptions(options, EntryTree.sep);
    if (issues.length) throw this._reject(options, issues);
    const id = this.tree.ensureId(options);
    const entry = this.tree.store[id] ??= new Entry(this.ctx.loader);
    entry.parent = this;
    await entry.update(options, true, true);
    return entry.id;
  }
  getOuterStack(id) {
    const location = this.tree.getLocation(id, []);
    const frames = location ? [`    at ${id} (${formatLocation(location)})`] : [];
    return [...frames, ...this.ctx.fiber.entry?.getOuterStack() ?? []];
  }
  _reject(options, issues) {
    const error = new EntryValidationError(issues);
    const id = options?.id;
    if (isNullable(id)) return error;
    const entry = this.tree.store[id];
    if (entry) {
      delete this.tree.store[id];
      entry.dispose();
      this.context.emit("loader/partial-dispose", entry, entry.options, false);
    }
    const frames = this.getOuterStack(id);
    if (!frames.length) return error;
    const locate = /* @__PURE__ */ __name((path) => this.tree.getLocation(id, path), "locate");
    relocate(error, formatIssues("invalid entry options", issues, locate), frames);
    return error;
  }
  unlink(options) {
    const config = this.data;
    const index = config.indexOf(options);
    if (index >= 0) config.splice(index, 1);
  }
  remove(id, isDispose = false) {
    const entry = this.tree.store[id];
    if (!entry || entry.parent !== this) return;
    delete this.tree.store[id];
    entry.dispose();
    if (!isDispose) {
      this.unlink(entry.options);
    }
    this.context.emit("loader/partial-dispose", entry, entry.options, false);
  }
  async update(config) {
    const oldConfig = this.data;
    this.data = config;
    const oldMap = Object.fromEntries(oldConfig.map((options) => [options?.id, options]));
    const newMap = Object.fromEntries(config.map((options) => [options?.id ?? /* @__PURE__ */ Symbol("anonymous"), options]));
    const ids = Reflect.ownKeys({ ...oldMap, ...newMap });
    await Promise.all(ids.map(async (id) => {
      if (newMap[id]) {
        await this.create(newMap[id]).catch((error) => {
          this.ctx.logger.error(error);
        });
      } else {
        this.remove(id);
      }
    }));
  }
  stop() {
    for (const options of this.data) {
      this.remove(options.id, true);
    }
  }
};
var Group = class extends EntryGroup {
  constructor(ctx, config) {
    super(ctx, ctx.fiber.entry.parent.tree);
    this.ctx = ctx;
    this.config = config;
    ctx.on("internal/update", (config2) => this.update(config2));
  }
  ctx;
  config;
  static {
    __name(this, "Group");
  }
  static initial = [];
  static [EntryGroup.key] = true;
  async *[Service.init]() {
    yield () => this.stop();
    await this.update(this.config);
  }
};

// src/resolve.ts
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
var HELPER_FILES = {
  ".gitignore": "# created by Cordis automatically\n*\n",
  // The one-argument form of `import.meta.resolve` anchors on this file, so
  // resolution happens in the project scope. A resolve call also survives a
  // bundling host, which transforms modules inside its root and redirects the
  // `import()` in them to its own resolver.
  "resolve.mjs": "export default (specifier) => import.meta.resolve(specifier)\n"
};
var cache = /* @__PURE__ */ Object.create(null);
var RENAME_RETRIES = 10;
var RENAME_BACKOFF = 20;
function isTransientRenameError(error) {
  const code = error?.code;
  return code === "EACCES" || code === "EPERM" || code === "EBUSY";
}
__name(isTransientRenameError, "isTransientRenameError");
function findScope(dir) {
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
__name(findScope, "findScope");
function resolveScope(baseUrl) {
  if (!baseUrl) return;
  let dir;
  try {
    dir = fileURLToPath(new URL(".", baseUrl));
  } catch {
    return;
  }
  return findScope(dir);
}
__name(resolveScope, "resolveScope");
async function write(path, content) {
  if (await readFile(path, "utf8").catch(() => void 0) === content) return;
  const temp = `${path}.${process.pid}`;
  await writeFile(temp, content);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temp, path);
      return;
    } catch (error) {
      if (attempt >= RENAME_RETRIES || !isTransientRenameError(error)) {
        await rm(temp, { force: true }).catch(() => {
        });
        throw error;
      }
    }
    await sleep(RENAME_BACKOFF * (attempt + 1));
  }
}
__name(write, "write");
async function _createResolve(scope) {
  const dir = join(scope, ".cordis");
  try {
    await mkdir(dir, { recursive: true });
    for (const [name, content] of Object.entries(HELPER_FILES)) {
      await write(join(dir, name), content);
    }
  } catch {
    return;
  }
  const url = pathToFileURL(join(dir, "resolve.mjs")).href;
  return (await import(
    /* @vite-ignore */
    url
  )).default;
}
__name(_createResolve, "_createResolve");
async function createResolve(baseUrl) {
  const scope = resolveScope(baseUrl);
  if (!scope) return;
  const resolve = await (cache[scope] ??= _createResolve(scope));
  if (!resolve) delete cache[scope];
  return resolve;
}
__name(createResolve, "createResolve");

// src/config/tree.ts
var driveLetter = /^[A-Za-z]:[\\/]/;
function parseNotFound(error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND" || typeof error.message !== "string") return;
  const [first, ...hints] = error.message.split("\n");
  const match = first.match(/^(Cannot find (?:module|package) '.*') imported from (.*)$/);
  if (match) return { description: match[1], parent: match[2], hints };
}
__name(parseNotFound, "parseNotFound");
function toPath(url) {
  try {
    return url.startsWith("file:") ? fileURLToPath2(url) : url;
  } catch {
    return url;
  }
}
__name(toPath, "toPath");
function members(entry) {
  const { tree } = entry.parent;
  const result = [entry];
  const group = entry.subgroup;
  if (group?.tree !== tree) return result;
  for (const options of group.data) {
    const member = tree.store[options.id];
    if (member?.parent === group) result.push(...members(member));
  }
  return result;
}
__name(members, "members");
var ModuleNotFoundError = class extends Error {
  constructor(specifier, message) {
    super(message);
    this.specifier = specifier;
  }
  specifier;
  static {
    __name(this, "ModuleNotFoundError");
  }
  name = "ModuleNotFoundError";
  code = "ERR_MODULE_NOT_FOUND";
};
var EntryTree = class _EntryTree {
  static {
    __name(this, "EntryTree");
  }
  static sep = ":";
  ctx;
  enableLogs;
  root;
  store = /* @__PURE__ */ Object.create(null);
  constructor(ctx) {
    this.ctx = ctx.extend({ baseUrl: ctx.baseUrl });
    this.root = new EntryGroup(this.ctx, this);
    const entry = this.ctx.fiber.entry;
    if (entry) entry.subtree = this;
  }
  get context() {
    return this.ctx;
  }
  *entries() {
    for (const entry of Object.values(this.store)) {
      yield entry;
      if (!entry.subtree) continue;
      yield* entry.subtree.entries();
    }
  }
  getTasks() {
    return [...this.entries()].flatMap((entry) => entry._initTask || [entry.outerFiber?.inertia, entry.innerFiber?.inertia]).filter(isNonNullable);
  }
  async await() {
    while (true) {
      const tasks = this.getTasks();
      if (!tasks.length) return;
      await Promise.allSettled(tasks);
    }
  }
  ensureId(options) {
    if (!options.id) {
      do {
        options.id = Math.random().toString(16).slice(2, 10);
      } while (this.store[options.id]);
    }
    return options.id;
  }
  resolve(id) {
    const parts = id.split(_EntryTree.sep);
    let tree = this;
    const final = parts.pop();
    for (const part of parts) {
      tree = tree.store[part]?.subtree;
      if (!tree) throw new Error(`cannot resolve entry ${id}`);
    }
    const entry = tree.store[final];
    if (!entry) throw new Error(`cannot resolve entry ${id}`);
    return entry;
  }
  resolveGroup(id) {
    if (!id) return this.root;
    const entry = this.resolve(id);
    if (!entry.subgroup) throw new Error(`entry ${id} is not a group`);
    return entry.subgroup;
  }
  async create(options, parent = null, position = Infinity) {
    const group = this.resolveGroup(parent);
    const issues = validateOptions(options, _EntryTree.sep, true);
    if (issues.length) throw new EntryValidationError(issues);
    const id = group.tree.ensureId(options);
    group.data.splice(position, 0, options);
    group.tree.commit({ id, group, options });
    return group.create(options);
  }
  remove(id) {
    const entry = this.resolve(id);
    const group = entry.parent;
    const legacy = entry.options;
    group.remove(legacy.id);
    group.tree.commit({ id: legacy.id, group, legacy });
  }
  async update(id, options, parent, position) {
    const entry = this.resolve(id);
    const source = entry.parent;
    const legacy = { ...entry.options };
    const issues = validateOptions(Entry.merge({ ...legacy }, options), _EntryTree.sep, true);
    if (issues.length) throw new EntryValidationError(issues);
    if (parent !== void 0) {
      const target = this.resolveGroup(parent);
      const moved = target.tree === source.tree ? [] : members(entry);
      for (const member of moved) {
        const { id: id2 } = member.options;
        if (target.tree.store[id2]) throw new Error(`entry ${id2} already exists in the target tree`);
      }
      source.unlink(entry.options);
      target.data.splice(position ?? Infinity, 0, entry.options);
      entry.parent = target;
      for (const member of moved) {
        delete source.tree.store[member.options.id];
        target.tree.store[member.options.id] = member;
        if (member.subgroup?.tree === source.tree) member.subgroup.tree = target.tree;
      }
    }
    const task = entry.update(options, false, true);
    if (entry.parent.tree !== source.tree) {
      source.tree.commit({ id: legacy.id, group: source, legacy });
      entry.parent.tree.commit({ id: legacy.id, group: entry.parent, options: entry.options });
    } else {
      const from = entry.parent === source ? void 0 : source;
      entry.parent.tree.commit({ id: legacy.id, group: entry.parent, from, options: entry.options, legacy });
    }
    return task;
  }
  import(name, getOuterStack) {
    if (process.platform === "win32" && driveLetter.test(name)) {
      name = pathToFileURL2(name).href;
    }
    let parent;
    let unresolved;
    return composeError(async (info) => {
      info.offset += 3;
      if (this.ctx.loader.internal) {
        parent = this.ctx.baseUrl;
        return await this.ctx.loader.internal.import(name, parent, {});
      } else if (name.startsWith(".")) {
        parent = import.meta.url;
        return await import(
          /* @vite-ignore */
          new URL(name, this.ctx.baseUrl).href
        );
      } else {
        const resolve = await createResolve(this.ctx.baseUrl);
        let url = name;
        if (resolve) {
          try {
            url = resolve(name);
          } catch (error) {
            unresolved = error;
            throw error;
          }
        }
        parent = import.meta.url;
        return await import(
          /* @vite-ignore */
          url
        );
      }
    }, getOuterStack).catch((error) => {
      const notFound = parseNotFound(error);
      if (!notFound) throw error;
      if (error !== unresolved && (!parent || notFound.parent !== toPath(parent))) throw error;
      const result = new ModuleNotFoundError(name, [notFound.description, ...notFound.hints].join("\n"));
      const frames = getOuterStack?.() ?? [];
      if (frames.length) result.stack = [`${result.name}: ${result.message}`, ...frames].join("\n");
      throw result;
    });
  }
  /**
   * Where a value of the entry options is written. A path that leaves the
   * source falls back to its deepest written ancestor.
   */
  getLocation(_id, _path) {
    return void 0;
  }
  locateExpr(_id, _path, _expr, _offset) {
    return void 0;
  }
};

// src/config/entry.ts
function takeEntries(object, keys) {
  const result = [];
  for (const key of keys) {
    if (!(key in object)) continue;
    result.push([key, object[key]]);
    delete object[key];
  }
  return result;
}
__name(takeEntries, "takeEntries");
function sortKeys(object, prepend = ["id", "name"], append = ["config"]) {
  const part1 = takeEntries(object, prepend);
  const part2 = takeEntries(object, append);
  const rest = takeEntries(object, Object.keys(object)).sort(([a], [b]) => a.localeCompare(b));
  return Object.assign(object, Object.fromEntries([...part1, ...rest, ...part2]));
}
__name(sortKeys, "sortKeys");
var outer = {
  name: "loader:outer",
  async *apply(ctx) {
    const entry = ctx[Entry.key];
    const exports = await entry._import();
    yield () => {
    };
    if (exports) entry._start(ctx, exports.component);
  }
};
var Entry = class _Entry {
  constructor(loader) {
    this.loader = loader;
    this.ctx = loader.ctx.extend({ [_Entry.key]: this });
    this.context.emit("loader/entry-init", this);
  }
  loader;
  static {
    __name(this, "Entry");
  }
  static key = /* @__PURE__ */ Symbol.for("cordis.entry");
  static isOuter(fiber) {
    return fiber.runtime?.callback === outer.apply;
  }
  ctx;
  outerFiber;
  innerFiber;
  parent;
  // safety: call `entry.update()` immediately after creating an entry
  options = {};
  subgroup;
  subtree;
  inject = /* @__PURE__ */ Object.create(null);
  _initTask;
  _disposing = false;
  _verdict;
  _intercept = /* @__PURE__ */ Object.create(null);
  static merge(target, options) {
    for (const [key, value] of Object.entries(options)) {
      if (isNullable2(value)) {
        delete target[key];
      } else {
        target[key] = value;
      }
    }
    return target;
  }
  get context() {
    return this.ctx;
  }
  get id() {
    let id = this.options.id;
    if (this.parent.tree.ctx.fiber.entry) {
      id = this.parent.tree.ctx.fiber.entry.id + EntryTree.sep + id;
    }
    return id;
  }
  // undefined while the outer fiber is pending
  _evaluationContext() {
    if (!this.outerFiber) return this.ctx;
    if (this.outerFiber.committed) return this.outerFiber.ctx;
  }
  _resolveDisabled(ctx) {
    const { disabled } = this.options;
    try {
      this._verdict = isJsExpr(disabled) ? !!evaluate(ctx, disabled.__jsExpr, this.trace(["disabled"])) : !!disabled;
    } catch (error) {
      this.ctx.logger.error(error);
      this._verdict = true;
    }
  }
  get disabled() {
    if (this.options.group) return false;
    return this._verdict !== false || this._parentDisabled();
  }
  _parentDisabled() {
    let entry = this.parent.ctx.fiber.entry;
    while (entry) {
      if (entry._verdict !== false) return true;
      entry = entry.parent.ctx.fiber.entry;
    }
    return false;
  }
  _blocked() {
    if (this.options.group) return false;
    if (!isJsExpr(this.options.disabled) && this.options.disabled) {
      this._verdict = true;
      return true;
    }
    return this._parentDisabled();
  }
  evaluate(expr) {
    const ctx = this._evaluationContext();
    if (!ctx) throw new Error(`entry ${this.id} is waiting for its dependencies`);
    return evaluate(ctx, expr);
  }
  _hasOuter() {
    return Object.keys(this.inject).length > 0;
  }
  // returns whether `inject` changed, or undefined on failure
  _resolveInject() {
    let inject;
    try {
      inject = Inject.resolve(this.options.inject);
      for (const key of Object.keys(inject)) {
        inject[key] = interpolate(this.parent.ctx, inject[key], this.trace, ["inject", key]);
      }
    } catch (error) {
      this.ctx.logger.error(error);
      this.inject = /* @__PURE__ */ Object.create(null);
      this._verdict = true;
      return;
    }
    const changed = !deepEqual(inject, this.inject, true);
    this.inject = inject;
    return changed;
  }
  _applyIntercept(ctx) {
    try {
      swap(this._intercept, interpolate(ctx, this.options.intercept, this.trace, ["intercept"]));
      return true;
    } catch (error) {
      this.ctx.logger.error(error);
      this._verdict = true;
      return false;
    }
  }
  async _patchContext(diff) {
    await this.context.waterfall("loader/patch-context", this, async () => {
      Object.setPrototypeOf(this.ctx, this.parent.ctx);
      Object.setPrototypeOf(this._intercept, this.parent.ctx[Context3.intercept]);
      if (this.outerFiber) {
        if (this.outerFiber.state !== FiberState.ACTIVE) return;
        await this._reconcile(this.outerFiber.ctx, diff);
      } else if (this.innerFiber?.uid) {
        await this._reconcile(this.ctx, diff);
      }
    });
  }
  async _reconcile(ctx, diff) {
    if (!this.innerFiber?.uid) {
      await this.outerFiber?.restart();
      return;
    }
    this._resolveDisabled(ctx);
    if (this.disabled || !this._applyIntercept(ctx)) {
      this._dispose(this.innerFiber);
      return;
    }
    if (diff.includes("config") || this.options.group) {
      await this.innerFiber.update(this.options.config, true);
    }
  }
  async refresh() {
    if (this.outerFiber || this.innerFiber) return;
    if (this._resolveInject() === void 0) return;
    if (this._blocked()) return;
    await this.init();
  }
  async update(options, create = false, force = false) {
    const legacy = { ...this.options };
    if (create) {
      this.options = options;
    } else {
      _Entry.merge(this.options, options);
    }
    sortKeys(this.options);
    const changed = this._resolveInject();
    if (changed === void 0) {
      this.dispose();
      return;
    }
    if (this._blocked()) {
      this.dispose();
      return;
    }
    const rebuild = changed || this.options.name !== legacy.name;
    if (rebuild || !this.outerFiber && !this.innerFiber?.uid) {
      await this.init(this.outerFiber || this.innerFiber?.uid ? this.dispose() : void 0);
      return;
    }
    const diff = Object.keys({ ...this.options, ...legacy }).filter((key) => !deepEqual(this.options[key], legacy[key]));
    if (!diff.length && !force) return;
    this.context.emit("loader/partial-dispose", this, legacy, true);
    await this._patchContext(diff);
  }
  dispose() {
    const fiber = this.outerFiber ?? this.innerFiber;
    this.outerFiber = void 0;
    return this._dispose(fiber);
  }
  _dispose(fiber) {
    this._disposing = true;
    try {
      return fiber?.dispose();
    } finally {
      this._disposing = false;
    }
  }
  getLocation(path = []) {
    return this.parent.tree.getLocation(this.options.id, path);
  }
  locateExpr(path, expr, offset) {
    return this.parent.tree.locateExpr(this.options.id, path, expr, offset);
  }
  getOuterStack = /* @__PURE__ */ __name(() => this.parent.getOuterStack(this.options.id), "getOuterStack");
  trace = /* @__PURE__ */ __name((path) => ({
    label: path.map(String).join("."),
    locate: /* @__PURE__ */ __name((expr, offset) => this.locateExpr(path, expr, offset), "locate"),
    getOuterStack: this.getOuterStack
  }), "trace");
  traceValidation(error) {
    const frames = this.getOuterStack();
    if (!frames.length) return;
    const issues = error.issues.map(({ message, path }) => ({ message, path: ValidationError.normalizePath(path) }));
    const locate = /* @__PURE__ */ __name((path) => this.getLocation(["config", ...path]), "locate");
    relocate(error, formatIssues("invalid config", issues, locate), frames);
  }
  _reportImport(error) {
    if (error instanceof ModuleNotFoundError) {
      const location = this.getLocation(["name"]);
      if (location) {
        const [first, ...hints] = error.message.split("\n");
        relocate(error, [`${first} (at name, ${formatLocation(location)})`, ...hints].join("\n"), this.getOuterStack());
      }
    }
    this.ctx.logger.error(error);
  }
  async init(disposeTask) {
    const task = this._initTask ??= this._init(disposeTask);
    try {
      await task;
    } finally {
      if (this._initTask === task) this._initTask = void 0;
    }
    Promise.resolve().then(() => this.outerFiber?.await()).then(() => this.innerFiber?.await()).catch(() => {
    }).finally(() => {
      if (this.loader.getTasks().length) return;
      this.ctx.reflect.notify(["loader"]);
    });
  }
  async _import() {
    try {
      const exports = await this.parent.tree.import(this.options.name, this.getOuterStack);
      return { component: this.loader.unwrapExports(exports) };
    } catch (error) {
      this._reportImport(error);
    }
  }
  async _init(disposeTask) {
    await disposeTask;
    if (this.outerFiber || this.innerFiber?.uid) return;
    this._verdict = void 0;
    const { name } = this.options;
    const exports = await this._import();
    if (name !== this.options.name) return this._init();
    if (!exports || !this._registered() || this._blocked()) return;
    await this._patchContext([]);
    if (name !== this.options.name) return this._init();
    if (!this._registered() || this._blocked()) return;
    this._initTask = void 0;
    if (this._hasOuter()) {
      this.outerFiber = this.ctx.registry.use({ ...outer, inject: this.inject }, void 0, this.getOuterStack);
    } else {
      this._start(this.ctx, exports.component);
    }
  }
  _registered() {
    return this.parent.tree.store[this.options.id] === this;
  }
  _start(ctx, component) {
    if (!this._registered()) return;
    this._resolveDisabled(ctx);
    if (this.disabled || !this._applyIntercept(ctx)) return;
    this.loader.showLog(this, "apply");
    const innerContext = ctx.extend({ [Context3.intercept]: this._intercept });
    this.innerFiber = innerContext.registry.use(component, this.options.config, this.getOuterStack);
  }
};

// src/config/isolate.ts
import { Context as Context4 } from "cordis";
var Realm = class {
  static {
    __name(this, "Realm");
  }
  store = /* @__PURE__ */ Object.create(null);
  access(key, create = false) {
    if (create) {
      return this.store[key] ??= /* @__PURE__ */ Symbol(`${key}${this.suffix}`);
    } else {
      return this.store[key] ?? /* @__PURE__ */ Symbol(`${key}${this.suffix}`);
    }
  }
  delete(key) {
    delete this.store[key];
  }
  get size() {
    return Object.keys(this.store).length;
  }
};
var LocalRealm = class extends Realm {
  constructor(entry) {
    super();
    this.entry = entry;
  }
  entry;
  static {
    __name(this, "LocalRealm");
  }
  get suffix() {
    return "#" + this.entry.options.id;
  }
};
var GlobalRealm = class extends Realm {
  constructor(label) {
    super();
    this.label = label;
  }
  label;
  static {
    __name(this, "GlobalRealm");
  }
  get suffix() {
    return "@" + this.label;
  }
};
function isolate(ctx) {
  const realms = /* @__PURE__ */ Object.create(null);
  const delims = /* @__PURE__ */ Object.create(null);
  function access(entry, name, create = false) {
    let realm;
    const label = entry.options.isolate?.[name];
    if (label === void 0) return;
    if (label === true) {
      realm = entry.realm ??= new LocalRealm(entry);
    } else if (create) {
      realm = realms[label] ??= new GlobalRealm(label);
    } else {
      realm = realms[label];
    }
    return realm?.access(name, create);
  }
  __name(access, "access");
  ctx.on("loader/entry-init", (entry) => {
    entry.ctx[Context4.isolate] = Object.create(entry.ctx[Context4.isolate]);
  });
  ctx.on("loader/patch-context", async (entry, next) => {
    const newMap = Object.create(entry.parent.ctx[Context4.isolate]);
    for (const name of Object.keys(entry.options.isolate ?? {})) {
      newMap[name] = access(entry, name, true);
    }
    const diff = /* @__PURE__ */ Object.create(null);
    const oldMap = entry.ctx[Context4.isolate];
    for (const name in { ...newMap, ...delims }) {
      if (newMap[name] === oldMap[name]) continue;
      const delim = delims[name] ??= /* @__PURE__ */ Symbol(`delim:${name}`);
      entry.ctx[delim] = /* @__PURE__ */ Symbol(`${name}#${entry.id}`);
      for (const symbol of [oldMap[name], newMap[name]]) {
        const impl = symbol && entry.ctx.reflect.store[symbol];
        if (!impl) continue;
        const fiber = impl.ctx.fiber;
        if (!fiber) {
          entry.ctx.logger.warn(new Error(`expected service ${name} to be implemented`));
          continue;
        }
        diff[name] = [oldMap[name], newMap[name], entry.ctx[delim], fiber.ctx[delim]];
        if (entry.ctx[delim] !== fiber.ctx[delim]) break;
      }
    }
    Object.setPrototypeOf(entry.ctx[Context4.isolate], entry.parent.ctx[Context4.isolate]);
    swap(entry.ctx[Context4.isolate], newMap);
    await next();
    for (const [symbol1, symbol2, flag1, flag2] of Object.values(diff)) {
      const impl = entry.ctx.reflect.store[symbol1];
      if (flag1 === flag2 && impl && !entry.ctx.reflect.store[symbol2]) {
        entry.ctx.reflect.store[symbol2] = impl;
        delete entry.ctx.reflect.store[symbol1];
        impl.isolate = symbol2;
      }
    }
    ctx.reflect.notify(Object.keys(diff), (ctx2, name) => {
      const [symbol1, symbol2, flag1, flag2] = diff[name];
      const symbol3 = ctx2[Context4.isolate][name];
      const flag3 = ctx2[delims[name]];
      return (symbol1 === symbol3 || symbol2 === symbol3) && flag1 === flag3 !== (flag1 === flag2);
    });
    for (const name in delims) {
      if (!Reflect.ownKeys(newMap).includes(name)) {
        delete entry.ctx[delims[name]];
      }
    }
  });
  ctx.on("loader/partial-dispose", (entry, legacy, active) => {
    for (const [name, label] of Object.entries(legacy.isolate ?? {})) {
      if (label === true) continue;
      if (active && entry.options.isolate?.[name] === label) continue;
      const realm = realms[label];
      if (!realm) continue;
      for (const entry2 of ctx.loader.entries()) {
        if (entry2.options.isolate?.[name] === realm.label) return;
      }
      realm.delete(name);
      if (!realm.size) {
        delete realms[realm.label];
      }
    }
  });
}
__name(isolate, "isolate");

// src/internal.ts
import { createRequire } from "node:module";
function getInternalLoader() {
  const require2 = createRequire(import.meta.url);
  const id = "internal/modules/esm/loader";
  let internal;
  if (process.execArgv.includes("--expose-internals")) {
    try {
      internal = require2(id);
    } catch {
    }
  }
  if (!internal) {
    try {
      internal = require2("node-addon-require-builtin").requireBuiltin(id);
    } catch {
    }
  }
  const loader = internal?.getOrInitializeCascadedLoader?.();
  if (typeof loader?.import === "function") return loader;
}
__name(getInternalLoader, "getInternalLoader");
function unwrapExports(exports) {
  if (exports === null || exports === void 0) return exports;
  exports = exports.default ?? exports;
  if (!exports.__esModule) return exports;
  return exports.default ?? exports;
}
__name(unwrapExports, "unwrapExports");

// src/index.ts
var Loader = class extends EntryTree {
  constructor(ctx, config = {}) {
    super(ctx);
    this.config = config;
    if (config.baseUrl) {
      this.ctx.baseUrl = config.baseUrl;
    }
    const self = this;
    defineProperty(this, Service2.tracker, {
      associate: "loader",
      property: "ctx",
      noShadow: true
    });
    ctx.reflect.provide("loader", this, this[Service2.check]);
    const sources = /* @__PURE__ */ new WeakMap();
    ctx.on("internal/config", (fiber, next) => {
      if (!fiber.entry || fiber.parent.fiber?.entry === fiber.entry) return next();
      try {
        return next();
      } catch (error) {
        if (ValidationError2.is(error) && sources.get(fiber) === fiber.entry.options.config) {
          fiber.entry.traceValidation(error);
        }
        throw error;
      }
    }, { prepend: true });
    ctx.on("internal/config", (fiber, next) => {
      const config2 = next();
      if (!fiber.entry || fiber.parent.fiber?.entry === fiber.entry) return config2;
      sources.set(fiber, config2);
      if (fiber.runtime.callback[EntryGroup.key]) return config2;
      return interpolate(fiber.ctx, config2, fiber.entry.trace, ["config"]);
    });
    ctx.on("internal/commit", (fiber, config2) => {
      if (!fiber.entry || fiber.parent.fiber?.entry === fiber.entry) return;
      const unparse = fiber.runtime?.Config?.["simplify"];
      const { entry } = fiber;
      const legacy = { ...entry.options };
      entry.options.config = unparse ? unparse(config2) : config2;
      entry.parent.tree.commit({ id: entry.options.id, group: entry.parent, options: entry.options, legacy });
    });
    ctx.on("internal/update", function(config2, next) {
      if (!this.entry || this.parent.fiber?.entry === this.entry) return next();
      self.showLog(this.entry, "reload");
      return next();
    }, { global: true });
    ctx.on("internal/status", (fiber) => {
      if (!Entry.isOuter(fiber) || fiber.state !== FiberState2.UNLOADING) return;
      const entry = fiber.parent[Entry.key];
      if (entry.outerFiber?.uid === fiber.uid) entry._verdict = void 0;
    });
    ctx.on("internal/plugin", (fiber) => {
      if (fiber.parent[Entry.key] && !fiber.entry && !Entry.isOuter(fiber)) {
        fiber.entry = fiber.parent[Entry.key];
      }
      if (fiber.uid) return;
      if (!fiber.entry) return;
      if (fiber.parent.fiber?.entry === fiber.entry) return;
      if (!fiber.entry.parent.tree.ctx.fiber.uid) return;
      const { entry } = fiber;
      this.showLog(entry, "unload");
      if (fiber.parent.fiber.state === FiberState2.UNLOADING) return;
      if (entry.parent.tree.store[entry.options.id] !== entry) return;
      if (entry._disposing) return;
      const legacy = { ...entry.options };
      entry.options.disabled = true;
      entry._verdict = true;
      entry.parent.tree.commit({ id: entry.options.id, group: entry.parent, options: entry.options, legacy });
      if (entry.outerFiber) entry.dispose();
    });
    ctx.use(isolate);
  }
  config;
  static {
    __name(this, "Loader");
  }
  envData = process.env.CORDIS_SHARED ? JSON.parse(process.env.CORDIS_SHARED) : { startTime: Date.now() };
  name = "loader";
  internal = getInternalLoader();
  commit(_change) {
  }
  [Service2.check]() {
    const config = Service2.prototype[Service2.resolveIntercept].call(this);
    if (config.await && this.getTasks().length) return false;
    return true;
  }
  showLog(entry, type) {
    if (entry.options.group || !entry.parent.tree.enableLogs) return;
    this.ctx[Context5.root].logger?.("loader").info("%s component %C", type, entry.options.name);
  }
  locate(fiber = this.ctx.fiber) {
    while (1) {
      if (fiber.entry) return fiber.entry.id;
      const next = fiber.parent.fiber;
      if (fiber === next) return;
      fiber = next;
    }
  }
  unwrapExports(exports) {
    return unwrapExports(exports);
  }
};
var index_default = Loader;
export {
  Entry,
  EntryGroup,
  EntryTree,
  EntryValidationError,
  GlobalRealm,
  Group,
  Loader,
  LocalRealm,
  ModuleNotFoundError,
  Realm,
  index_default as default,
  evaluate,
  formatIssue,
  formatIssues,
  formatLocation,
  interpolate,
  isJsExpr,
  relocate,
  swap,
  validateOptions
};
