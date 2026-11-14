var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { EntryTree, isJsExpr } from "@cordisjs/loader";
import { Context, Service } from "cordis";
import { deepEqual as deepEqual2 } from "cosmokit";
import { basename, dirname, extname, join } from "node:path";
import { access, constants, readFile, rename, rm, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  Scalar,
  stringify
} from "yaml";
import { stringifyString } from "yaml/util";

// src/journal.ts
import { deepEqual, omit } from "cosmokit";
function diffOptions(legacy, options) {
  const changes = {};
  for (const key of /* @__PURE__ */ new Set([...Object.keys(legacy), ...Object.keys(options)])) {
    if (key === "id") continue;
    if (deepEqual(legacy[key], options[key])) continue;
    changes[key] = options[key];
  }
  return changes;
}
__name(diffOptions, "diffOptions");
function mergeRecords(older, newer) {
  if (!older) return newer;
  if (newer.kind === "remove") {
    return older.kind === "upsert" && older.created ? void 0 : newer;
  }
  if (older.kind === "remove") {
    return { ...newer, created: false };
  }
  const relocated = newer.parent !== void 0;
  return {
    kind: "upsert",
    created: older.created,
    parent: relocated ? newer.parent : older.parent,
    position: relocated ? newer.position : older.position,
    changes: { ...older.changes, ...newer.changes }
  };
}
__name(mergeRecords, "mergeRecords");
function merge(journal, id, record2) {
  const merged = mergeRecords(journal.get(id), record2);
  if (merged) {
    journal.set(id, merged);
  } else {
    journal.delete(id);
  }
}
__name(merge, "merge");
function record(journal, change, parent) {
  const { id, options, legacy } = change;
  if (!options) {
    return merge(journal, id, { kind: "remove" });
  }
  const position = change.group.data.indexOf(options);
  if (!legacy) {
    return merge(journal, id, { kind: "upsert", created: true, parent, position, changes: omit(options, ["id"]) });
  }
  merge(journal, id, {
    kind: "upsert",
    created: false,
    parent: change.from ? parent : void 0,
    position,
    changes: diffOptions(legacy, options)
  });
}
__name(record, "record");
function flatten(data, parent = null, result = /* @__PURE__ */ new Map()) {
  data.forEach((options, position) => {
    if (options.id) result.set(options.id, { parent, position, options, list: data });
    if (options.group && Array.isArray(options.config)) {
      flatten(options.config, options.id ?? null, result);
    }
  });
  return result;
}
__name(flatten, "flatten");
function applyChanges(options, changes, filter) {
  for (const [key, value] of Object.entries(changes)) {
    if (filter && !filter(key)) continue;
    if (value === void 0) {
      delete options[key];
    } else {
      options[key] = value;
    }
  }
}
__name(applyChanges, "applyChanges");
function detach(data, id) {
  const flat = flatten(data).get(id);
  if (!flat) return;
  flat.list.splice(flat.list.indexOf(flat.options), 1);
  return flat.options;
}
__name(detach, "detach");
function place(data, options, parent, position) {
  let list = data;
  if (parent !== null) {
    const group = flatten(data).get(parent);
    if (!group?.options.group) return false;
    list = group.options.config ??= [];
  }
  list.splice(Math.min(position, list.length), 0, options);
  return true;
}
__name(place, "place");
function applyJournal(data, journal, filter = () => true, warn = () => {
}) {
  for (const [id, record2] of journal) {
    if (!filter(id, null)) continue;
    if (record2.kind === "remove") {
      detach(data, id);
      continue;
    }
    const flat = flatten(data).get(id);
    if (!flat) {
      const options = { id };
      applyChanges(options, record2.changes, (key) => filter(id, key));
      const parent = record2.parent ?? null;
      if (!place(data, options, parent, record2.position)) {
        warn("cannot place entry %C: group %C not found", id, parent);
      }
      continue;
    }
    applyChanges(flat.options, record2.changes, (key) => filter(id, key));
    if (record2.parent !== void 0 && flat.parent !== record2.parent) {
      detach(data, id);
      if (!place(data, flat.options, record2.parent, record2.position)) {
        warn("cannot move entry %C: group %C not found", id, record2.parent);
        place(data, flat.options, flat.parent, flat.position);
      }
    }
  }
  return data;
}
__name(applyJournal, "applyJournal");
function reconcile(journal, base, theirs, fileOwned) {
  const conflicts = [];
  for (const [id, record2] of journal) {
    if (!fileOwned(id, null)) continue;
    const b = base.get(id);
    const t = theirs.get(id);
    if (record2.kind === "remove") {
      if (!t) {
        journal.delete(id);
      } else if (!b || !deepEqual(t.options, b.options)) {
        conflicts.push({ id, reason: b ? "modified in file, removed at runtime" : "added in file, removed at runtime" });
        journal.delete(id);
      }
      continue;
    }
    if (!t) {
      if (b) {
        conflicts.push({ id, reason: "removed in file, modified at runtime" });
        journal.delete(id);
      }
      continue;
    }
    if (record2.created) record2.created = false;
    for (const key of Object.keys(record2.changes)) {
      if (!fileOwned(id, key)) continue;
      const bv = b?.options[key];
      const tv = t.options[key];
      if (deepEqual(bv, tv) || deepEqual(tv, record2.changes[key])) continue;
      conflicts.push({ id, reason: `key "${key}" modified both in file and at runtime` });
      delete record2.changes[key];
    }
    if (record2.parent !== void 0 && b && t.parent !== b.parent && t.parent !== record2.parent) {
      conflicts.push({ id, reason: "moved both in file and at runtime" });
      record2.parent = void 0;
    }
    const moved = record2.parent !== void 0 && record2.parent !== t.parent;
    if (!Object.keys(record2.changes).length && !moved) {
      journal.delete(id);
    }
  }
  return conflicts;
}
__name(reconcile, "reconcile");

// src/patch.ts
function randomId(used) {
  let id;
  do {
    id = Math.random().toString(16).slice(2, 10);
  } while (used(id));
  return id;
}
__name(randomId, "randomId");
function ensureIds(entries, used) {
  for (const entry of entries) {
    if (!entry.id) entry.id = randomId(used);
    if (entry.group && Array.isArray(entry.config)) ensureIds(entry.config, used);
  }
}
__name(ensureIds, "ensureIds");
function ensureInsertIds(patches, used) {
  for (const patch of patches ?? []) {
    if (patch.insert) ensureIds(patch.insert, used);
  }
}
__name(ensureInsertIds, "ensureInsertIds");
var FILE = { type: "file" };
var PatchIndex = class {
  constructor(owners, keys) {
    this.owners = owners;
    this.keys = keys;
  }
  owners;
  keys;
  static {
    __name(this, "PatchIndex");
  }
  /** Owner of the entry as a whole. */
  entry(id) {
    if (id === null) return FILE;
    return this.owners.get(id) ?? FILE;
  }
  /** Owner of one key of an entry. */
  key(id, key) {
    const index = this.keys.get(id)?.get(key);
    return index === void 0 ? this.entry(id) : { type: "patch", index };
  }
  fileOwned(id, key) {
    return (key === null ? this.entry(id) : this.key(id, key)).type === "file";
  }
};
function applyPatches(data, patches, warn = () => {
}) {
  data = structuredClone(data);
  const entries = /* @__PURE__ */ new Map();
  const owners = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Map();
  const mount = /* @__PURE__ */ __name((list, owner) => {
    for (const options of list) {
      if (options.id) {
        entries.set(options.id, options);
        owners.set(options.id, owner);
        keys.delete(options.id);
      }
      if (options.group && Array.isArray(options.config)) mount(options.config, owner);
    }
  }, "mount");
  const unmount = /* @__PURE__ */ __name((list) => {
    for (const options of list) {
      if (options.id) {
        entries.delete(options.id);
        owners.delete(options.id);
        keys.delete(options.id);
      }
      if (options.group && Array.isArray(options.config)) unmount(options.config);
    }
  }, "unmount");
  mount(data, FILE);
  patches?.forEach((patch, index) => {
    const { id, insert, name, ...overrides } = patch;
    const target = id ? entries.get(id) : void 0;
    if (insert) {
      if (id && !target) return warn("patch insert: entry %C not found", id);
      if (target && !target.group) return warn("patch insert: entry %C is not a group", id);
      const clone = structuredClone(insert);
      if (target) {
        if (!Array.isArray(target.config)) target.config = [];
        target.config.push(...clone);
      } else {
        data.push(...clone);
      }
      mount(clone, { type: "embedded", index, key: "insert" });
      return;
    }
    if (!id) return warn("patch: id is required for non-insert patches");
    if (!target) return warn("patch: entry %C not found", id);
    if (name && name !== target.name) {
      return warn("patch: name mismatch for %C (expected %C, got %C), skipping", id, target.name, name);
    }
    if ("config" in overrides && target.group && Array.isArray(target.config)) {
      unmount(target.config);
    }
    const overridden = keys.get(id) ?? /* @__PURE__ */ new Map();
    keys.set(id, overridden);
    for (const [key, value] of Object.entries(overrides)) {
      target[key] = value;
      overridden.set(key, index);
    }
    if ("config" in overrides && target.group && Array.isArray(target.config)) {
      ensureIds(target.config, (id2) => entries.has(id2));
      target.config = structuredClone(target.config);
      mount(target.config, { type: "embedded", index, key: "config" });
    }
  });
  return { data, index: new PatchIndex(owners, keys) };
}
__name(applyPatches, "applyPatches");
function routeJournal(journal, data, patches, warn) {
  let { index } = applyPatches(data, patches);
  let patched = false;
  const reindex = /* @__PURE__ */ __name(() => {
    index = applyPatches(data, patches).index;
  }, "reindex");
  const container = /* @__PURE__ */ __name((owner) => {
    if (owner.type === "file") return { list: data, parent: null };
    const patch = patches[owner.index];
    return { list: patch[owner.key], parent: patch.id ?? null };
  }, "container");
  const children = /* @__PURE__ */ __name((parent) => {
    const owner = index.key(parent, "config");
    if (owner.type === "file") return;
    if (owner.type === "patch") {
      const config = patches[owner.index].config;
      return Array.isArray(config) ? config : void 0;
    }
    const found = flatten(container(owner).list).get(parent);
    return found && (found.options.config ??= []);
  }, "children");
  const placeAt = /* @__PURE__ */ __name((options, parent, position) => {
    const list = parent === null ? void 0 : children(parent);
    if (list) {
      list.splice(Math.min(position, list.length), 0, options);
      patched = true;
    } else if (!place(data, options, parent, position)) {
      warn("cannot place entry %C: group %C not found", options.id, parent);
    }
  }, "placeAt");
  for (const [id, record2] of journal) {
    const owner = index.entry(id);
    const { list, parent: base } = container(owner);
    const embedded = owner.type === "embedded";
    if (record2.kind === "remove") {
      detach(list, id);
      patched ||= embedded;
      reindex();
      continue;
    }
    const current = flatten(list).get(id);
    if (!current) {
      const options = { id };
      applyChanges(options, record2.changes);
      placeAt(options, record2.parent ?? null, record2.position);
      reindex();
      continue;
    }
    if (record2.parent !== void 0 && (current.parent ?? base) !== record2.parent) {
      detach(list, id);
      patched ||= embedded;
      applyChanges(current.options, record2.changes);
      placeAt(current.options, record2.parent, record2.position);
      reindex();
      continue;
    }
    const patchChanges = {};
    applyChanges(current.options, record2.changes, (key) => {
      const keyOwner = index.key(id, key);
      if (keyOwner.type !== "patch") return true;
      (patchChanges[keyOwner.index] ??= {})[key] = record2.changes[key];
      return false;
    });
    patched ||= embedded;
    for (const [i, changes] of Object.entries(patchChanges)) {
      applyChanges(patches[i], changes);
      patched = true;
    }
  }
  return patched;
}
__name(routeJournal, "routeJournal");

// src/index.ts
var driveLetter = /^[A-Za-z]:[\\/]/;
var JsExpr = {
  tag: "tag:yaml.org,2002:js",
  identify: isJsExpr,
  resolve: /* @__PURE__ */ __name((source) => ({ __jsExpr: source }), "resolve"),
  // quoted like any other string
  stringify: /* @__PURE__ */ __name((item, ctx, onComment, onChompKeep) => {
    const scalar = new Scalar(item.value.__jsExpr);
    return stringifyString(Object.assign(scalar, { type: item.type }), ctx, onComment, onChompKeep);
  }, "stringify")
};
var yamlOptions = {
  schema: "core",
  customTags: [JsExpr]
};
var types = {
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml"
};
function parseSyntax(content) {
  const lines = new LineCounter();
  const document = parseDocument(content, { ...yamlOptions, prettyErrors: false, lineCounter: lines });
  return { document, lines };
}
__name(parseSyntax, "parseSyntax");
var jsonPosition = /\s+at position (\d+)(?: \(line \d+ column \d+\))?$/;
var ConfigFileError = class extends Error {
  constructor(stage, path, cause, issues = []) {
    super([`failed to ${stage} config file ${path}`, ...issues.map(({ message, location }) => {
      return `  - ${message} (at ${location.filename}:${location.line}:${location.column})`;
    })].join("\n"), { cause });
    this.stage = stage;
    this.issues = issues;
  }
  stage;
  issues;
  static {
    __name(this, "ConfigFileError");
  }
  name = "ConfigFileError";
};
var StaleWriteError = class extends Error {
  static {
    __name(this, "StaleWriteError");
  }
  name = "StaleWriteError";
};
function isENOENT(error) {
  return error?.code === "ENOENT";
}
__name(isENOENT, "isENOENT");
var RENAME_RETRIES = 10;
var RENAME_BACKOFF = 20;
function isTransientRenameError(error) {
  const code = error?.code;
  return code === "EACCES" || code === "EPERM" || code === "EBUSY";
}
__name(isTransientRenameError, "isTransientRenameError");
function findEntry(entries, id) {
  for (const [index, options] of entries.entries()) {
    if (options.id === id) return [index];
    if (!options.group || !Array.isArray(options.config)) continue;
    const path = findEntry(options.config, id);
    if (path) return [index, "config", ...path];
  }
}
__name(findEntry, "findEntry");
function findInvalidEntries(entries, prefix = []) {
  return entries.flatMap((options, index) => {
    if (!options || typeof options !== "object" || Array.isArray(options)) return [[...prefix, index]];
    if (!options.group || !Array.isArray(options.config)) return [];
    return findInvalidEntries(options.config, [...prefix, index, "config"]);
  });
}
__name(findInvalidEntries, "findInvalidEntries");
function walk(document, path) {
  let node = document.contents;
  let anchor = isNode(node) ? node.range : void 0;
  let complete = true;
  for (const key of path) {
    if (isAlias(node)) node = node.resolve(document);
    if (isMap(node)) {
      const pair = node.items.find((pair2) => String(isScalar(pair2.key) ? pair2.key.value : pair2.key) === String(key));
      if (!pair) {
        complete = false;
        break;
      }
      node = pair.value;
      if (isNode(pair.key)) anchor = pair.key.range;
    } else if (isSeq(node)) {
      const item = node.items[key];
      if (!isNode(item)) {
        complete = false;
        break;
      }
      node = item;
      anchor = item.range;
    } else {
      complete = false;
      break;
    }
  }
  if (isAlias(node)) node = node.resolve(document);
  if (isScalar(node)) anchor = node.range;
  return { node, anchor, complete };
}
__name(walk, "walk");
function seek(document, path) {
  return walk(document, path).anchor;
}
__name(seek, "seek");
var isBlank = /* @__PURE__ */ __name((char) => char === " " || char === "	" || char === "\n" || char === "\r", "isBlank");
var escapes = Object.fromEntries([
  "0\0",
  "a\x07",
  "b\b",
  "t	",
  "		",
  "n\n",
  "v\v",
  "f\f",
  "r\r",
  "e\x1B",
  "  ",
  '""',
  "//",
  "\\\\",
  "N",
  "_ ",
  "L\u2028",
  "P\u2029"
].map(([key, value]) => [key, value]));
var hexLengths = { x: 2, u: 4, U: 8 };
function scanScalar(content, node) {
  const [start, end] = node.range;
  const units = [];
  let index = start;
  let stop = end;
  if (node.type === Scalar.BLOCK_LITERAL || node.type === Scalar.BLOCK_FOLDED) {
    index = content.indexOf("\n", start);
    if (index === -1) return units;
  } else if (node.type === Scalar.QUOTE_DOUBLE || node.type === Scalar.QUOTE_SINGLE) {
    index += 1;
    stop -= 1;
  }
  while (index < stop) {
    const char = content[index];
    if (node.type === Scalar.QUOTE_DOUBLE && char === "\\") {
      const next = content[index + 1];
      const length = hexLengths[next];
      let decoded = "";
      if (length) {
        decoded = String.fromCodePoint(parseInt(content.slice(index + 2, index + 2 + length), 16));
      } else if (next in escapes) {
        decoded = escapes[next];
      }
      for (const unit of decoded.split("")) {
        if (!isBlank(unit)) units.push(index);
      }
      index += 2 + (length ?? 0);
    } else if (node.type === Scalar.QUOTE_SINGLE && char === "'" && content[index + 1] === "'") {
      units.push(index);
      index += 2;
    } else {
      if (!isBlank(char)) units.push(index);
      index += 1;
    }
  }
  return units;
}
__name(scanScalar, "scanScalar");
function seekExpr(content, document, path, expr, offset) {
  const { complete, ...rest } = walk(document, path);
  let { node } = rest;
  if (complete && isMap(node)) {
    const pair = node.items.find((pair2) => isScalar(pair2.key) && pair2.key.value === "__jsExpr");
    if (isScalar(pair?.value)) node = pair.value;
  }
  if (!complete || !isScalar(node) || !node.range) return;
  const value = isJsExpr(node.value) ? node.value.__jsExpr : node.value;
  if (value !== expr) return;
  let rank = 0;
  let total = 0;
  for (let index = 0; index < value.length; index++) {
    if (isBlank(value[index])) continue;
    if (index < offset) rank += 1;
    total += 1;
  }
  const units = scanScalar(content, node);
  if (units.length !== total || rank >= total) return node.range[0];
  return units[rank];
}
__name(seekExpr, "seekExpr");
var Include = class extends EntryTree {
  constructor(ctx, config) {
    super(ctx);
    this.config = config;
    this.enableLogs = config.enableLogs ?? ctx.fiber.entry?.parent.tree.enableLogs ?? false;
    this.filename = fileURLToPath(process.platform === "win32" && driveLetter.test(this.config.path) ? pathToFileURL(this.config.path) : new URL(this.config.path, this.ctx.baseUrl));
    const ext = extname(this.filename);
    if (!types[ext]) {
      throw new Error(`extension "${ext}" not supported`);
    }
    this.type = types[ext];
    this.ctx.baseUrl = new URL(".", pathToFileURL(this.filename)).href;
    ensureInsertIds(config.patches, (id) => !!this.store[id]);
    ctx.on("internal/update", (config2, next) => {
      if (config2.path !== this.config.path || !config2.watch !== !this.config.watch) return next();
      this.config = config2;
      ensureInsertIds(config2.patches, (id) => !!this.store[id]);
      this._scheduleApply();
      return this._applyTask;
    });
    if (config.watch) {
      ctx.inject(["fs"], (ctx2) => {
        ctx2.fs.watch(pathToFileURL(this.filename)).on("change", () => this.refresh());
      });
    }
  }
  config;
  static {
    __name(this, "Include");
  }
  static inject = ["loader"];
  filename;
  type;
  /** The last file state we read or wrote. */
  cache;
  /** Tree-side changes that have not reached the file yet. */
  journal = /* @__PURE__ */ new Map();
  /** Where the entries of the applied tree come from. */
  index;
  /** Ids we assigned to entries the file leaves anonymous. */
  anonymous = /* @__PURE__ */ new Map();
  dirtyRead = false;
  dirtyWrite = false;
  _draining;
  /** Only the latest intended tree is ever applied; older ones are skipped. */
  _pendingTree;
  _applyTask;
  _disposed = false;
  _seq = 0;
  warn = /* @__PURE__ */ __name((format, ...args) => {
    this.ctx[Context.root].logger?.("loader").warn(format, ...args);
  }, "warn");
  async *[Service.init]() {
    try {
      await this._read();
    } catch (error) {
      const cause = error instanceof ConfigFileError && error.stage === "read" ? error.cause : void 0;
      if (!isENOENT(cause)) throw error;
      if (!this.config.initial) {
        throw new Error(`config file not found: ${this.filename}`);
      }
      const initial = structuredClone(this.config.initial);
      ensureIds(initial, (id) => !!this.store[id]);
      await this._writeText(this.dump(initial));
      await this._read();
    }
    yield () => this.stop();
    await this._applyTask;
  }
  async stop() {
    this._disposed = true;
    this._pendingTree = void 0;
    if (this.journal.size) {
      this.dirtyWrite = true;
      this._drain();
    }
    await this.flush();
    this.root.stop();
  }
  /**
   * Resolves once every pending read and write has been processed and the
   * tree reflects the outcome. Unlike `refresh()`, this does wait for writes.
   */
  async flush() {
    while (this._draining || this._applyTask) {
      await this._draining;
      await this._applyTask;
    }
  }
  /** Re-read the file and reconcile the tree with it. */
  refresh() {
    this.dirtyRead = true;
    this._drain();
    return this.flush();
  }
  /** Called synchronously by the loader once a tree-side change is in place. */
  commit(change) {
    this.context.emit("loader/config-update");
    const parent = change.group === this.root ? null : change.group.ctx.fiber.entry.options.id;
    record(this.journal, change, parent);
    this.dirtyWrite = true;
    this._drain();
  }
  _drain() {
    if (this._draining) return;
    this._draining = this._loop().finally(() => {
      this._draining = void 0;
    });
  }
  async _loop() {
    while (this.dirtyRead || this.dirtyWrite) {
      if (this.dirtyRead) {
        this.dirtyRead = false;
        try {
          await this._read();
        } catch (error) {
          this.ctx.logger.warn(error);
          if (this.dirtyRead) continue;
          return;
        }
      }
      if (this.dirtyWrite) {
        this.dirtyWrite = false;
        try {
          await this._write();
        } catch (error) {
          this.ctx.logger.error(error);
        }
      }
    }
  }
  async _read() {
    let content;
    try {
      content = await readFile(this.filename, "utf8");
    } catch (error) {
      throw new ConfigFileError("read", this.filename, error);
    }
    if (content === this.cache?.content) return;
    let data;
    let syntax;
    if (this.type === "application/yaml") {
      syntax = parseSyntax(content);
      const { document, lines } = syntax;
      const errors = [...document.errors, ...document.warnings];
      if (errors.length) {
        const issues = errors.map((error) => ({ message: error.message, location: this._locate(lines, error.pos[0]) }));
        throw new ConfigFileError("parse", this.filename, void 0, issues);
      }
      data = document.toJS();
    } else {
      try {
        data = JSON.parse(content);
      } catch (error) {
        const match = error instanceof SyntaxError && error.message.match(jsonPosition);
        if (!match) throw new ConfigFileError("parse", this.filename, error);
        const message = error.message.slice(0, match.index);
        const location = this._locate(parseSyntax(content).lines, +match[1]);
        throw new ConfigFileError("parse", this.filename, void 0, [{ message, location }]);
      }
    }
    if (!Array.isArray(data)) {
      const message = "config file must be a top-level array";
      const { document, lines } = syntax ?? parseSyntax(content);
      const range = document.contents?.range;
      if (!range) throw new ConfigFileError("validate", this.filename, new TypeError(message));
      throw new ConfigFileError("validate", this.filename, void 0, [{ message, location: this._locate(lines, range[0]) }]);
    }
    const invalid = findInvalidEntries(data);
    if (invalid.length) {
      const { document, lines } = syntax ?? parseSyntax(content);
      const issues = invalid.map((path) => {
        const range = seek(document, path);
        return { message: "entry must be an object", location: this._locate(lines, range?.[0] ?? 0) };
      });
      throw new ConfigFileError("validate", this.filename, void 0, issues);
    }
    this._assignIds(data);
    if (this.cache) {
      const { index } = applyPatches(data, this.config.patches);
      const conflicts = reconcile(this.journal, flatten(this.cache.data), flatten(data), (id, key) => index.fileOwned(id, key));
      for (const { id, reason } of conflicts) {
        this.ctx.logger.error("config conflict in %C: entry %C %s; file wins", this.filename, id, reason);
      }
    }
    this.cache = { content, data, syntax };
    this._scheduleApply();
    if (this.journal.size) this.dirtyWrite = true;
  }
  async _write() {
    if (!this.cache || !this.journal.size) return;
    const current = await readFile(this.filename, "utf8").catch((error) => {
      if (isENOENT(error)) return void 0;
      throw error;
    });
    if (current === void 0) {
      this.ctx.logger.warn("config file %C is missing, %d pending change(s) kept in memory", this.filename, this.journal.size);
      return;
    }
    if (current !== this.cache.content) {
      this.dirtyRead = true;
      this.dirtyWrite = true;
      return;
    }
    const batch = this.journal;
    this.journal = /* @__PURE__ */ new Map();
    const restore = /* @__PURE__ */ __name(() => {
      for (const [id, record2] of this.journal) merge(batch, id, record2);
      this.journal = batch;
    }, "restore");
    const data = structuredClone(this.cache.data);
    const patches = structuredClone(this.config.patches ?? []);
    if (routeJournal(batch, data, patches, this.warn)) {
      this.config = { ...this.config, patches };
      if (this.ctx.fiber.entry) {
        try {
          Promise.resolve(this.ctx.fiber.update(this.config)).catch((error) => {
            this.ctx.logger.error(error);
          });
        } catch (error) {
          this.ctx.logger.error(error);
        }
      } else {
        this.ctx.logger.warn("patches of %C changed at runtime but cannot be persisted", this.filename);
      }
    }
    if (deepEqual2(data, this.cache.data)) {
      this._scheduleApply();
      return;
    }
    const text = this.dump(data);
    try {
      await access(this.filename, constants.W_OK);
    } catch {
      restore();
      this.ctx.logger.warn("config file %C is read-only, %d pending change(s) kept in memory", this.filename, this.journal.size);
      return;
    }
    try {
      await this._writeText(text, this.cache.content);
    } catch (error) {
      restore();
      if (error instanceof StaleWriteError) {
        this.dirtyRead = true;
        this.dirtyWrite = true;
        return;
      }
      this.ctx.logger.warn("failed to write config file %C, %d pending change(s) kept in memory", this.filename, this.journal.size);
      throw error;
    }
    this.cache = { content: text, data };
    this._scheduleApply();
  }
  /**
   * Write through a temp file and a rename, so that no reader ever sees a
   * truncated file. When `expected` is given, the rename (and every retry of
   * it) only goes ahead while the file still holds that content.
   */
  async _writeText(text, expected) {
    const tmp = join(dirname(this.filename), `.${basename(this.filename)}.${process.pid}.${this._seq++}.tmp`);
    try {
      await writeFile(tmp, text);
      for (let attempt = 0; ; attempt++) {
        if (expected !== void 0) {
          const current = await readFile(this.filename, "utf8").catch((error) => {
            if (isENOENT(error)) return void 0;
            throw error;
          });
          if (current !== expected) throw new StaleWriteError();
        }
        try {
          await rename(tmp, this.filename);
          return;
        } catch (error) {
          if (attempt >= RENAME_RETRIES || !isTransientRenameError(error)) throw error;
        }
        await sleep(RENAME_BACKOFF * (attempt + 1));
      }
    } catch (error) {
      await rm(tmp, { force: true }).catch(() => {
      });
      throw error;
    }
  }
  dump(data) {
    return this.type === "application/yaml" ? stringify(data, { ...yamlOptions, singleQuote: true }) : JSON.stringify(data, null, 2);
  }
  getLocation(id, path) {
    const route = this._route(id, path);
    if (!route) return;
    if (route.entry) return route.entry.getLocation(route.path);
    const { document, lines } = this.cache.syntax ??= parseSyntax(this.cache.content);
    const range = seek(document, route.path);
    if (range) return this._locate(lines, range[0]);
  }
  locateExpr(id, path, expr, offset) {
    const route = this._route(id, path);
    if (!route) return;
    if (route.entry) return route.entry.locateExpr(route.path, expr, offset);
    const { document, lines } = this.cache.syntax ??= parseSyntax(this.cache.content);
    const position = seekExpr(this.cache.content, document, route.path, expr, offset);
    if (position !== void 0) return this._locate(lines, position);
  }
  _route(id, path) {
    if (!this.cache || !this.index) return;
    const record2 = this.journal.get(id);
    if (record2?.kind === "remove") return;
    if (path.length && record2 && String(path[0]) in record2.changes) return;
    const owner = path.length ? this.index.key(id, String(path[0])) : this.index.entry(id);
    const { entry } = this.ctx.fiber;
    if (owner.type === "patch") {
      if (!entry) return;
      return { entry, path: ["config", "patches", owner.index, ...path] };
    } else if (owner.type === "embedded") {
      const prefix2 = findEntry(this.config.patches[owner.index][owner.key], id);
      if (!prefix2 || !entry) return;
      return { entry, path: ["config", "patches", owner.index, owner.key, ...prefix2, ...path] };
    }
    const prefix = findEntry(this.cache.data, id);
    if (!prefix) return;
    return { path: [...prefix, ...path] };
  }
  _locate(lines, offset) {
    const { line, col } = lines.linePos(offset);
    return { filename: this.filename, line, column: col };
  }
  /**
   * Entries the file leaves anonymous get an id here, before the loader sees
   * them. One that looks exactly like an entry we named on the previous read
   * keeps that id, unless it is already explicitly owned, so editing a
   * neighbor does not restart it; anything else gets a fresh id. Assigned
   * ids stay in memory until the next write.
   */
  _assignIds(data) {
    const used = /* @__PURE__ */ new Set();
    const collect = /* @__PURE__ */ __name((entries) => {
      for (const options of entries) {
        if (options.id) used.add(options.id);
        if (options.group && Array.isArray(options.config)) collect(options.config);
      }
    }, "collect");
    collect(data);
    for (const patch of this.config.patches ?? []) {
      if (patch.insert) collect(patch.insert);
    }
    const previous = this.anonymous;
    this.anonymous = /* @__PURE__ */ new Map();
    const assign = /* @__PURE__ */ __name((entries, parent) => {
      for (const options of entries) {
        if (!options.id) {
          let id;
          for (const [candidate, info] of previous) {
            if (info.parent !== parent || used.has(candidate) || !deepEqual2(info.options, options)) continue;
            id = candidate;
            previous.delete(candidate);
            break;
          }
          if (!id) {
            do {
              id = Math.random().toString(16).slice(2, 10);
            } while (used.has(id) || this.store[id]);
          }
          used.add(id);
          this.anonymous.set(id, { parent, options: structuredClone(options) });
          const rest = { ...options };
          for (const key of Object.keys(options)) delete options[key];
          Object.assign(options, { id }, rest);
        }
        if (options.group && Array.isArray(options.config)) assign(options.config, options.id);
      }
    }, "assign");
    assign(data, null);
  }
  _scheduleApply() {
    if (this._disposed || !this.cache) return;
    const { data, index } = applyPatches(this.cache.data, this.config.patches, this.warn);
    this.index = index;
    this._pendingTree = applyJournal(data, this.journal, void 0, this.warn);
    this._applyTask ??= (async () => {
      try {
        while (this._pendingTree) {
          const tree = this._pendingTree;
          this._pendingTree = void 0;
          await this.root.update(tree);
        }
      } finally {
        this._applyTask = void 0;
      }
    })();
  }
};
var index_default = Include;
export {
  ConfigFileError,
  Include,
  index_default as default
};
