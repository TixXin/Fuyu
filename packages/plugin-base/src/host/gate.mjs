import { RpcError } from "./rpc.mjs";
import { SOURCE } from "./sources.mjs";

export const KINDS = ["essential", "builtin", "third-party"];
export const SAFE_MODES = { "third-party": ["essential", "builtin"], minimal: ["essential"] };
export const FAULT_LIMIT = { errors: 5, windowMs: 60_000 };
export const BISECT_REASON = "switched off for this run by the plugin bisect, which looks for the plugin behind a problem; it comes back when the bisect moves on or ends";

export function kindOf(options) {
  return KINDS.includes(options?.kind) ? options.kind : "third-party";
}

function text(error) {
  return String(error?.stack ?? error?.message ?? error).slice(0, 2000);
}

function bisectList(off) {
  if (!Array.isArray(off) || off.some((id) => typeof id !== "string" || !id)) {
    throw new RpcError("bad-params", "bisect needs { off: [...] }, the ids of the third-party plugins to switch off", { method: "bisect", field: "off" });
  }
  return [...new Set(off)];
}

export class Gate {
  constructor({ safe = null, limit = FAULT_LIMIT, internal = new Set(), bisect = [] } = {}) {
    if (safe !== null && !Object.hasOwn(SAFE_MODES, safe)) throw new Error(`unknown safe mode ${safe}; use ${Object.keys(SAFE_MODES).join(" or ")}`);
    this.safe = safe;
    this.limit = { ...FAULT_LIMIT, ...limit };
    this.internal = internal;
    this.blocked = new Map();
    this.faults = new Map();
    this.off = new Set(bisectList(bisect));
    this.seen = new WeakSet();
    this.ctx = null;
  }

  install(ctx) {
    this.ctx = ctx;
    return ctx.on("loader/entry-init", (entry) => {
      const original = entry._blocked;
      entry._blocked = () => (this.verdict(entry) ? true : original.call(entry));
    });
  }

  verdict(entry) {
    const { id, name } = entry.options;
    if (this.internal.has(name)) return null;
    const rejected = entry.options[SOURCE]?.rejected;
    if (rejected) return { state: "failed", reason: rejected.reason, blocked: { by: "manifest", errors: rejected.errors } };
    const blocked = this.blocked.get(id);
    if (blocked) return blocked;
    if (this.safe && !SAFE_MODES[this.safe].includes(kindOf(entry.options))) {
      return { state: "safe-mode", blocked: { by: "safe-mode", mode: this.safe }, reason: `safe mode "${this.safe}" keeps only ${SAFE_MODES[this.safe].join(" and ")} plugins; this one is ${kindOf(entry.options)}` };
    }
    if (this.off.has(id) && kindOf(entry.options) === "third-party") return { state: "bisect", blocked: { by: "bisect" }, reason: BISECT_REASON };
    return null;
  }

  record(id) {
    let record = this.faults.get(id);
    if (!record) this.faults.set(id, (record = { total: 0, recent: [], last: null }));
    return record;
  }

  report(id) {
    const record = this.faults.get(id);
    return { total: record?.total ?? 0, last: record?.last ?? null };
  }

  fault(id, error) {
    if (!id) return false;
    if (error !== null && typeof error === "object") {
      if (this.seen.has(error)) return false;
      this.seen.add(error);
    }
    if (this.blocked.has(id)) return false;
    const now = Date.now();
    const record = this.record(id);
    record.total += 1;
    record.last = { at: now, text: text(error) };
    record.recent = record.recent.filter((at) => now - at < this.limit.windowMs);
    record.recent.push(now);
    if (record.recent.length < this.limit.errors) return false;
    this.block(id, {
      state: "auto-disabled",
      at: now,
      blocked: { by: "errors", errors: record.recent.length, windowMs: this.limit.windowMs },
      reason: `${record.recent.length} errors within ${Math.round(this.limit.windowMs / 1000)} s; it stays off until the host restarts. Last error: ${record.last.text.split("\n")[0]}`,
    });
    return true;
  }

  entries() {
    return this.ctx ? [...this.ctx.loader.entries()] : [];
  }

  dispose(entry) {
    try {
      Promise.resolve(entry.dispose()).catch((error) => this.ctx.logger("gate").error(error));
    } catch (error) {
      this.ctx.logger("gate").error(error);
    }
  }

  block(id, verdict) {
    this.blocked.set(id, verdict);
    if (!this.ctx) return;
    const entry = this.entries().find((item) => item.options.id === id);
    setImmediate(() => {
      if (entry) this.dispose(entry);
      this.ctx.emit("plugin-base/gate", id);
    });
  }

  bisect(off) {
    const ids = bisectList(off);
    const entries = this.entries();
    const refused = entries
      .filter((entry) => ids.includes(entry.options.id) && (this.internal.has(entry.options.name) || kindOf(entry.options) !== "third-party"))
      .map((entry) => ({ id: entry.options.id, kind: this.internal.has(entry.options.name) ? "internal" : kindOf(entry.options) }));
    if (refused.length) {
      throw new RpcError("not-third-party", `only third-party plugins can be switched off for a bisect; ${refused.map(({ id, kind }) => `${id} is ${kind}`).join(", ")}`, { refused });
    }
    const before = this.off;
    this.off = new Set(ids);
    const held = entries.filter((entry) => this.off.has(entry.options.id) && !before.has(entry.options.id));
    const freed = entries.filter((entry) => before.has(entry.options.id) && !this.off.has(entry.options.id));
    if (this.ctx) {
      setImmediate(() => {
        held.forEach((entry) => this.dispose(entry));
        for (const entry of freed) {
          if (entry.outerFiber || entry.innerFiber?.uid || this.verdict(entry)) continue;
          Promise.resolve(entry.update({}, false, true)).catch((error) => this.ctx.logger("gate").error(error));
        }
        this.ctx.emit("plugin-base/gate", null);
      });
    }
    return { off: ids, unknown: ids.filter((id) => !entries.some((entry) => entry.options.id === id)) };
  }
}
