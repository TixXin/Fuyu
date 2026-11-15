export const KINDS = ["essential", "builtin", "third-party"];
export const SAFE_MODES = { "third-party": ["essential", "builtin"], minimal: ["essential"] };
export const FAULT_LIMIT = { errors: 5, windowMs: 60_000 };

export function kindOf(options) {
  return KINDS.includes(options?.kind) ? options.kind : "third-party";
}

function text(error) {
  return String(error?.stack ?? error?.message ?? error).slice(0, 2000);
}

export class Gate {
  constructor({ safe = null, limit = FAULT_LIMIT, internal = new Set() } = {}) {
    if (safe !== null && !Object.hasOwn(SAFE_MODES, safe)) throw new Error(`unknown safe mode ${safe}; use ${Object.keys(SAFE_MODES).join(" or ")}`);
    this.safe = safe;
    this.limit = { ...FAULT_LIMIT, ...limit };
    this.internal = internal;
    this.blocked = new Map();
    this.faults = new Map();
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
    const blocked = this.blocked.get(id);
    if (blocked) return blocked;
    if (this.safe && !SAFE_MODES[this.safe].includes(kindOf(entry.options))) {
      return { state: "safe-mode", blocked: { by: "safe-mode", mode: this.safe }, reason: `safe mode "${this.safe}" keeps only ${SAFE_MODES[this.safe].join(" and ")} plugins; this one is ${kindOf(entry.options)}` };
    }
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

  block(id, verdict) {
    this.blocked.set(id, verdict);
    if (!this.ctx) return;
    const entry = [...this.ctx.loader.entries()].find((item) => item.options.id === id);
    setImmediate(() => {
      if (!entry) return void this.ctx.emit("plugin-base/gate", id);
      try {
        Promise.resolve(entry.dispose()).catch((error) => this.ctx.logger("gate").error(error));
      } catch (error) {
        this.ctx.logger("gate").error(error);
      }
      this.ctx.emit("plugin-base/gate", id);
    });
  }
}
