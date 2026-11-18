import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pluginWindowsV1 } from "../services.mjs";
import { pluginId } from "./clients.mjs";
import { entryOf, installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";
import { SOURCE } from "./sources.mjs";

export const WINDOW_RULES_FILE = "window-rules.json";
export const MAX_WINDOWS_PER_PLUGIN = 8;
export const MAX_WINDOWS_TOTAL = 24;

const DEFAULT_RULES = Object.freeze({
  disallowAlwaysOnTop: false,
  disallowClickThrough: false,
  hideAll: false,
});

function checkExperimental(ctx) {
  const entry = entryOf(ctx);
  const meta = entry?.options?.[SOURCE];
  if (!meta || meta.source === "builtin") return;
  const exp = meta.declared?.experimental ?? [];
  if (exp.includes("windows/v1") || exp.includes("windows")) return;
  throw Object.assign(new Error('ctx.windows requires fuyu.experimental to include "windows/v1"'), {
    code: "experimental-required",
  });
}

function readRulesFile(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, raw] of Object.entries(parsed)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      clean[id] = {
        disallowAlwaysOnTop: raw.disallowAlwaysOnTop === true,
        disallowClickThrough: raw.disallowClickThrough === true,
        hideAll: raw.hideAll === true,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

function writeRulesFile(file, rules) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(rules, null, 2)}\n`);
}

function applyGuardrails(desired, rules) {
  return {
    ...desired,
    alwaysOnTop: rules.disallowAlwaysOnTop ? false : Boolean(desired.alwaysOnTop),
    clickThrough: rules.disallowClickThrough ? false : Boolean(desired.clickThrough),
    visible: rules.hideAll ? false : Boolean(desired.visible),
  };
}

export class PluginWindows {
  constructor({ dir, services, usage = null }) {
    this.file = join(dir, WINDOW_RULES_FILE);
    this.services = services;
    this.usage = usage;
    this.rpc = null;
    this.handle = null;
    this.rules = readRulesFile(this.file);
    this.windows = new Map();
    this.listeners = new Map();
  }

  install(ctx) {
    const manager = this;
    const unaccess = installInjectableAccessor(ctx, "windows", function () {
      const caller = this;
      return Object.freeze({
        create: (spec) => manager.create(caller, spec),
        update: (id, patch) => manager.update(caller, id, patch),
        show: (id) => manager.show(caller, id),
        hide: (id) => manager.hide(caller, id),
        focus: (id) => manager.focus(caller, id),
        close: (id) => manager.close(caller, id),
        list: () => manager.listForPlugin(caller),
        onEvent: (listener) => manager.onEvent(caller, listener),
      });
    });
    this.handle = this.services.provideBuiltin(ctx, pluginWindowsV1, {
      getRules: (params) => this.getRules(params),
      setRules: (params) => this.setRules(params),
      list: (params) => this.listAll(params),
    });
    return () => {
      void unaccess();
      void this.handle?.dispose();
    };
  }

  attach(rpc) {
    this.rpc = rpc;
    rpc.handle("windowEvent", (params) => this.deliverEvent(params));
  }

  async callRpc(method, params) {
    if (!this.rpc) return null;
    try {
      return await this.rpc.call(method, params);
    } catch (error) {
      if (error?.code === "no-method" || error?.code === "peer-gone") return null;
      throw error;
    }
  }

  rulesFor(id) {
    return { ...DEFAULT_RULES, ...(this.rules[id] ?? {}) };
  }

  totalCount() {
    let total = 0;
    for (const map of this.windows.values()) total += map.size;
    return total;
  }

  async create(ctx, spec = {}) {
    checkExperimental(ctx);
    const owner = pluginId(ctx);
    const id = spec?.id;
    if (typeof id !== "string" || id.trim() === "") {
      throw serviceError("bad-params", "ctx.windows.create needs a non-empty window id");
    }
    const title = typeof spec?.title === "string" && spec.title.trim() !== "" ? spec.title : id;
    let bucket = this.windows.get(owner);
    if (!bucket) this.windows.set(owner, (bucket = new Map()));
    if (!bucket.has(id)) {
      if (bucket.size >= MAX_WINDOWS_PER_PLUGIN) {
        throw serviceError("limit", `plugin ${owner} already has ${MAX_WINDOWS_PER_PLUGIN} open windows`);
      }
      if (this.totalCount() >= MAX_WINDOWS_TOTAL) {
        throw serviceError("limit", `the plugin host already has ${MAX_WINDOWS_TOTAL} open plugin windows`);
      }
    }
    const desired = {
      pluginId: owner,
      id,
      title,
      kind: typeof spec.kind === "string" && spec.kind ? spec.kind : "overlay",
      width: typeof spec.width === "number" && spec.width > 0 ? spec.width : 360,
      height: typeof spec.height === "number" && spec.height > 0 ? spec.height : 280,
      x: typeof spec.x === "number" ? spec.x : null,
      y: typeof spec.y === "number" ? spec.y : null,
      alwaysOnTop: Boolean(spec.alwaysOnTop),
      clickThrough: Boolean(spec.clickThrough),
      resizable: Boolean(spec.resizable),
      visible: spec.visible === undefined ? true : Boolean(spec.visible),
    };
    const state = applyGuardrails(desired, this.rulesFor(owner));
    const record = { id, desired, state };
    const stopEffect = ctx.effect(() => {
      bucket.set(id, record);
      return () => {
        if (bucket.get(id) !== record) return;
        bucket.delete(id);
        if (bucket.size === 0 && this.windows.get(owner) === bucket) this.windows.delete(owner);
        void this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "close" }).catch(() => {});
        this.emitChanged();
      };
    }, `ctx.windows.create(${id})`);
    record.stopEffect = stopEffect;
    await this.callRpc("pluginKernel.windowOpen", {
      spec: {
        pluginId: owner,
        windowId: id,
        title: state.title,
        kind: state.kind,
        width: state.width,
        height: state.height,
        x: state.x,
        y: state.y,
        alwaysOnTop: state.alwaysOnTop,
        clickThrough: state.clickThrough,
        resizable: state.resizable,
        visible: state.visible,
      },
    });
    this.emitChanged();
    return { ...state };
  }

  requireWindow(ctx, id) {
    checkExperimental(ctx);
    if (typeof id !== "string" || !id) throw serviceError("bad-params", "window id is required");
    const owner = pluginId(ctx);
    const record = this.windows.get(owner)?.get(id);
    if (!record) throw serviceError("not-found", `window ${id} is not open for ${owner}`, { pluginId: owner, windowId: id });
    return { owner, record };
  }

  async update(ctx, id, patch = {}) {
    const { owner, record } = this.requireWindow(ctx, id);
    if (typeof patch?.title === "string") record.desired.title = patch.title;
    if (typeof patch?.width === "number" && patch.width > 0) record.desired.width = patch.width;
    if (typeof patch?.height === "number" && patch.height > 0) record.desired.height = patch.height;
    if (patch?.x === null || typeof patch?.x === "number") record.desired.x = patch.x;
    if (patch?.y === null || typeof patch?.y === "number") record.desired.y = patch.y;
    if (typeof patch?.alwaysOnTop === "boolean") record.desired.alwaysOnTop = patch.alwaysOnTop;
    if (typeof patch?.clickThrough === "boolean") record.desired.clickThrough = patch.clickThrough;
    if (typeof patch?.resizable === "boolean") record.desired.resizable = patch.resizable;
    if (typeof patch?.visible === "boolean") record.desired.visible = patch.visible;
    record.state = applyGuardrails(record.desired, this.rulesFor(owner));
    const applied = {
      ...(typeof patch?.title === "string" ? { title: record.state.title } : {}),
      ...(typeof patch?.width === "number" ? { width: record.state.width } : {}),
      ...(typeof patch?.height === "number" ? { height: record.state.height } : {}),
      ...(patch?.x === null || typeof patch?.x === "number" ? { x: record.state.x } : {}),
      ...(patch?.y === null || typeof patch?.y === "number" ? { y: record.state.y } : {}),
      ...(typeof patch?.alwaysOnTop === "boolean" ? { alwaysOnTop: record.state.alwaysOnTop } : {}),
      ...(typeof patch?.clickThrough === "boolean" ? { clickThrough: record.state.clickThrough } : {}),
      ...(typeof patch?.resizable === "boolean" ? { resizable: record.state.resizable } : {}),
      ...(typeof patch?.visible === "boolean" ? { visible: record.state.visible } : {}),
    };
    await this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "update", ...applied });
    this.emitChanged();
    return { ...record.state };
  }

  async show(ctx, id) {
    const { owner, record } = this.requireWindow(ctx, id);
    record.desired.visible = true;
    record.state = applyGuardrails(record.desired, this.rulesFor(owner));
    if (record.state.visible) {
      await this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "show" });
    }
    this.emitChanged();
    return { ...record.state };
  }

  async hide(ctx, id) {
    const { owner, record } = this.requireWindow(ctx, id);
    record.desired.visible = false;
    record.state.visible = false;
    await this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "hide" });
    this.emitChanged();
    return { ...record.state };
  }

  async focus(ctx, id) {
    const { owner, record } = this.requireWindow(ctx, id);
    if (record.state.visible) {
      await this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "focus" });
    }
    return { ...record.state };
  }

  async close(ctx, id) {
    checkExperimental(ctx);
    if (typeof id !== "string" || !id) throw serviceError("bad-params", "window id is required");
    const owner = pluginId(ctx);
    const bucket = this.windows.get(owner);
    const record = bucket?.get(id);
    if (!record) return { closed: false };
    bucket.delete(id);
    if (bucket.size === 0 && this.windows.get(owner) === bucket) this.windows.delete(owner);
    void record.stopEffect?.();
    await this.callRpc("pluginKernel.windowControl", { pluginId: owner, windowId: id, action: "close" });
    this.emitChanged();
    return { closed: true };
  }

  listForPlugin(ctx) {
    checkExperimental(ctx);
    const owner = pluginId(ctx);
    const bucket = this.windows.get(owner);
    return bucket ? [...bucket.values()].map((record) => ({ ...record.state })) : [];
  }

  onEvent(ctx, listener) {
    checkExperimental(ctx);
    if (typeof listener !== "function") throw new TypeError("ctx.windows.onEvent needs a listener function");
    const owner = pluginId(ctx);
    const run = this.usage ? this.usage.wrap(owner, listener) : listener;
    return ctx.effect(() => {
      let set = this.listeners.get(owner);
      if (!set) this.listeners.set(owner, (set = new Set()));
      const hook = { ctx, run, active: true };
      set.add(hook);
      return () => {
        hook.active = false;
        set.delete(hook);
        if (set.size === 0 && this.listeners.get(owner) === set) this.listeners.delete(owner);
      };
    }, "ctx.windows.onEvent()");
  }

  deliverEvent(params) {
    const owner = params?.pluginId;
    const windowId = params?.windowId;
    if (typeof owner !== "string" || typeof windowId !== "string") return;
    if (params.type === "closed") {
      const bucket = this.windows.get(owner);
      const record = bucket?.get(windowId);
      if (record) {
        bucket.delete(windowId);
        if (bucket.size === 0 && this.windows.get(owner) === bucket) this.windows.delete(owner);
        void record.stopEffect?.();
        this.emitChanged();
      }
    }
    const hooks = this.listeners.get(owner);
    if (!hooks) return;
    const { pluginId: _pluginId, ...event } = params;
    for (const hook of [...hooks]) {
      if (!hook.active) continue;
      try {
        hook.run(event);
      } catch (error) {
        hook.ctx.logger.error(error);
      }
    }
  }

  getRules(params = {}) {
    const id = params?.id;
    if (typeof id !== "string" || !id) throw serviceError("bad-params", "plugin-windows.getRules needs { id }");
    return this.rulesFor(id);
  }

  async setRules(params = {}) {
    const id = params?.id;
    if (typeof id !== "string" || !id) throw serviceError("bad-params", "plugin-windows.setRules needs { id }");
    const prev = this.rulesFor(id);
    const next = {
      disallowAlwaysOnTop: typeof params.disallowAlwaysOnTop === "boolean" ? params.disallowAlwaysOnTop : prev.disallowAlwaysOnTop,
      disallowClickThrough: typeof params.disallowClickThrough === "boolean" ? params.disallowClickThrough : prev.disallowClickThrough,
      hideAll: typeof params.hideAll === "boolean" ? params.hideAll : prev.hideAll,
    };
    if (!next.disallowAlwaysOnTop && !next.disallowClickThrough && !next.hideAll) {
      delete this.rules[id];
    } else {
      this.rules[id] = next;
    }
    writeRulesFile(this.file, this.rules);
    const bucket = this.windows.get(id);
    if (bucket) {
      for (const record of bucket.values()) {
        const before = record.state;
        const after = applyGuardrails(record.desired, next);
        record.state = after;
        if (next.hideAll && before.visible) {
          await this.callRpc("pluginKernel.windowControl", { pluginId: id, windowId: record.id, action: "hide" });
        } else if (!next.hideAll && !before.visible && after.visible) {
          await this.callRpc("pluginKernel.windowControl", { pluginId: id, windowId: record.id, action: "show" });
        }
        if (before.alwaysOnTop !== after.alwaysOnTop || before.clickThrough !== after.clickThrough) {
          await this.callRpc("pluginKernel.windowControl", {
            pluginId: id,
            windowId: record.id,
            action: "update",
            alwaysOnTop: after.alwaysOnTop,
            clickThrough: after.clickThrough,
          });
        }
      }
    }
    this.emitChanged({ id, ...next });
    return { ...next };
  }

  listAll(params = {}) {
    const filterId = typeof params?.id === "string" && params.id ? params.id : null;
    const items = [];
    for (const [owner, bucket] of this.windows.entries()) {
      if (filterId && owner !== filterId) continue;
      for (const record of bucket.values()) items.push({ ...record.state });
    }
    return { items };
  }

  emitChanged(rules) {
    this.handle?.emit("changed", {
      items: this.listAll().items,
      ...(rules ? { rules } : {}),
    });
  }
}
