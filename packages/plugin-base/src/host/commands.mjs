import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { commandsV1 } from "../services.mjs";
import { pluginId } from "./clients.mjs";
import { entryOf, installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";
import { SOURCE } from "./sources.mjs";
import { INTERNAL } from "./status.mjs";

export const KEYBINDINGS_FILE = "keybindings.json";

function readOverrides(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [plugin, map] of Object.entries(parsed)) {
      if (!map || typeof map !== "object" || Array.isArray(map)) continue;
      const entries = Object.entries(map).filter(([, val]) => typeof val === "string");
      if (entries.length > 0) clean[plugin] = Object.fromEntries(entries);
    }
    return clean;
  } catch {
    return {};
  }
}

function writeOverrides(file, overrides) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(overrides, null, 2)}\n`);
}

export class Commands {
  constructor({ dir, services, usage = null }) {
    this.file = join(dir, KEYBINDINGS_FILE);
    this.services = services;
    this.usage = usage;
    this.ctx = null;
    this.rpc = null;
    this.handle = null;
    this.registered = new Map();
    this.undeclared = new Map();
    this.watchers = new Set();
    this.overrides = readOverrides(this.file);
    this.conflicts = {};
    this.lastBindingsKey = null;
  }

  install(ctx) {
    this.ctx = ctx;
    const commands = this;
    const unaccess = installInjectableAccessor(ctx, "commands", function () {
      const caller = this;
      return Object.freeze({
        register: (commandId, handler, meta) => commands.register(caller, commandId, handler, meta),
      });
    });
    this.handle = this.services.provideBuiltin(ctx, commandsV1, {
      list: () => this.list(),
      run: (params) => this.run(params),
      setKeybinding: (params) => this.setKeybinding(params),
    });
    const offStatus = ctx.on("internal/status", () => {
      void this.syncIfChanged();
    });
    const offInit = ctx.on("loader/entry-init", () => {
      void this.syncIfChanged();
    });
    return () => {
      offStatus();
      offInit();
      void unaccess();
      void this.handle?.dispose();
    };
  }

  attach(rpc) {
    this.rpc = rpc;
    rpc.handle("hotkey", (params) =>
      this.run({
        plugin: params?.pluginId ?? params?.plugin,
        command: params?.command,
        args: params?.args,
      }),
    );
  }

  register(ctx, commandId, handler, meta) {
    if (typeof commandId !== "string" || commandId.trim() === "") {
      throw new TypeError("ctx.commands.register needs a non-empty command id");
    }
    if (typeof handler !== "function") {
      throw new TypeError(`ctx.commands.register(${commandId}) needs a handler function`);
    }
    const entry = entryOf(ctx);
    const id = entry?.options?.id ?? pluginId(ctx);
    const run = this.usage ? this.usage.wrap(id, handler) : handler;
    const declared = entry?.options?.[SOURCE]?.declared;
    const isUndeclared = Boolean(declared && !(declared.commands ?? []).includes(commandId));
    return ctx.effect(() => {
      let bucket = this.registered.get(id);
      if (!bucket) this.registered.set(id, (bucket = new Map()));
      if (bucket.has(commandId)) throw new Error(`command ${commandId} is already registered by ${id}`);
      bucket.set(commandId, {
        handler: run,
        title: meta?.title ?? { "zh-CN": commandId, en: commandId },
        defaultKeybinding: typeof meta?.keybinding === "string" ? meta.keybinding : null,
      });
      if (isUndeclared) {
        let set = this.undeclared.get(id);
        if (!set) this.undeclared.set(id, (set = new Set()));
        set.add(commandId);
        this.notifyWatchers();
      }
      void this.syncIfChanged();
      this.emitChanged();
      return () => {
        bucket.delete(commandId);
        if (bucket.size === 0 && this.registered.get(id) === bucket) this.registered.delete(id);
        if (isUndeclared) {
          const set = this.undeclared.get(id);
          set?.delete(commandId);
          if (set && set.size === 0) this.undeclared.delete(id);
          this.notifyWatchers();
        }
        void this.syncIfChanged();
        this.emitChanged();
      };
    }, `ctx.commands.register(${commandId})`);
  }

  effectiveKeybinding(plugin, commandId, defaultKeybinding) {
    const pluginMap = this.overrides[plugin];
    if (pluginMap && Object.hasOwn(pluginMap, commandId)) {
      const override = pluginMap[commandId];
      return override === "" ? null : override;
    }
    return defaultKeybinding ?? null;
  }

  conflictsFor(plugin, commandId, keybinding, active, siblingItems) {
    if (!active || !keybinding) return [];
    const direct = this.conflicts[`${plugin}:${commandId}`] ?? this.conflicts[`${plugin}/${commandId}`];
    const list = Array.isArray(direct) ? [...direct] : [];
    const pluginList = this.conflicts[plugin];
    if (!Array.isArray(pluginList) || pluginList.length === 0) return list;
    const matchesItem = (msg, item) =>
      msg === item.keybinding ||
      msg === item.id ||
      (item.keybinding && msg.includes(item.keybinding)) ||
      msg.includes(item.id);
    for (const msg of pluginList) {
      if (typeof msg !== "string") continue;
      const matchedAny = siblingItems.some((item) => item.active && item.keybinding && matchesItem(msg, item));
      if (!matchedAny || matchesItem(msg, { id: commandId, keybinding })) {
        if (!list.includes(msg)) list.push(msg);
      }
    }
    return list;
  }

  rawItems() {
    if (!this.ctx) return [];
    const visited = new Set();
    const groups = [];
    for (const entry of this.ctx.loader?.entries() ?? []) {
      if (INTERNAL.has(entry.options.name)) continue;
      const id = entry.options.id;
      visited.add(id);
      const meta = entry.options[SOURCE];
      const pluginName = meta?.displayName ?? null;
      const active = entry.options.disabled !== true && !meta?.rejected;
      const seenCmds = new Set();
      const pluginItems = [];
      for (const cmd of meta?.commands ?? []) {
        seenCmds.add(cmd.id);
        const defaultKeybinding = cmd.keybinding ?? null;
        pluginItems.push({
          pluginId: id,
          pluginName,
          id: cmd.id,
          title: cmd.title,
          defaultKeybinding,
          keybinding: this.effectiveKeybinding(id, cmd.id, defaultKeybinding),
          active,
        });
      }
      const runtime = this.registered.get(id);
      if (runtime) {
        for (const [cmdId, info] of runtime.entries()) {
          if (seenCmds.has(cmdId)) continue;
          pluginItems.push({
            pluginId: id,
            pluginName,
            id: cmdId,
            title: info.title,
            defaultKeybinding: info.defaultKeybinding,
            keybinding: this.effectiveKeybinding(id, cmdId, info.defaultKeybinding),
            active,
          });
        }
      }
      if (pluginItems.length > 0) groups.push(pluginItems);
    }
    for (const [id, runtime] of this.registered.entries()) {
      if (visited.has(id)) continue;
      const pluginItems = [];
      for (const [cmdId, info] of runtime.entries()) {
        pluginItems.push({
          pluginId: id,
          pluginName: null,
          id: cmdId,
          title: info.title,
          defaultKeybinding: info.defaultKeybinding,
          keybinding: this.effectiveKeybinding(id, cmdId, info.defaultKeybinding),
          active: true,
        });
      }
      if (pluginItems.length > 0) groups.push(pluginItems);
    }
    return groups.flatMap((group) =>
      group.map((item) => ({
        ...item,
        conflicts: this.conflictsFor(item.pluginId, item.id, item.keybinding, item.active, group),
      })),
    );
  }

  list() {
    return { items: this.rawItems() };
  }

  async run(params = {}) {
    const plugin = params?.plugin;
    const command = params?.command;
    if (typeof plugin !== "string" || !plugin || typeof command !== "string" || !command) {
      throw serviceError("bad-params", "commands.run needs { plugin, command }");
    }
    const entry = this.registered.get(plugin)?.get(command);
    if (!entry) {
      throw serviceError("not-running", `command ${command} of plugin ${plugin} is not running`, { plugin, command });
    }
    const result = await entry.handler(params?.args);
    return result === undefined ? null : result;
  }

  async setKeybinding(params = {}) {
    const { plugin, command, keybinding } = params ?? {};
    if (typeof plugin !== "string" || !plugin || typeof command !== "string" || !command) {
      throw serviceError("bad-params", "commands.setKeybinding needs { plugin, command, keybinding }");
    }
    if (keybinding !== null && typeof keybinding !== "string") {
      throw serviceError("bad-params", "keybinding must be a string or null");
    }
    if (keybinding === null) {
      if (this.overrides[plugin]) {
        delete this.overrides[plugin][command];
        if (Object.keys(this.overrides[plugin]).length === 0) delete this.overrides[plugin];
      }
    } else {
      this.overrides[plugin] ??= {};
      this.overrides[plugin][command] = keybinding;
    }
    writeOverrides(this.file, this.overrides);
    await this.syncHotkeys();
    const result = this.list();
    this.handle?.emit("changed", result);
    return result;
  }

  bindingsPayload() {
    return this.rawItems()
      .filter((item) => item.active && item.keybinding)
      .map((item) => ({ pluginId: item.pluginId, command: item.id, shortcut: item.keybinding }));
  }

  async syncIfChanged() {
    if (!this.rpc || !this.ctx) return;
    const bindings = this.bindingsPayload();
    const key = JSON.stringify(bindings);
    if (this.lastBindingsKey === null && bindings.length === 0) {
      this.lastBindingsKey = key;
      return;
    }
    if (key === this.lastBindingsKey) return;
    await this.syncHotkeys(bindings, key);
  }

  async syncHotkeys(precomputed = null, precomputedKey = null) {
    if (!this.rpc || !this.ctx) return;
    const bindings = precomputed ?? this.bindingsPayload();
    this.lastBindingsKey = precomputedKey ?? JSON.stringify(bindings);
    let response;
    try {
      response = await this.rpc.call("pluginKernel.syncHotkeys", { bindings });
    } catch {
      return;
    }
    const next = response?.conflicts && typeof response.conflicts === "object" && !Array.isArray(response.conflicts) ? response.conflicts : {};
    if (JSON.stringify(next) !== JSON.stringify(this.conflicts)) {
      this.conflicts = next;
      this.emitChanged();
    }
  }

  emitChanged() {
    this.handle?.emit("changed", this.list());
  }

  undeclaredOf(plugin) {
    return [...(this.undeclared.get(plugin) ?? [])];
  }

  watch(listener) {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  notifyWatchers() {
    for (const listener of this.watchers) listener();
  }
}
