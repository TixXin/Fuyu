const DEFAULT_RULES = { kind: "list", max: Infinity, perPlugin: 4 };

export class SlotError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SlotError";
    this.code = code;
  }
}

export function createSlots(definitions = {}) {
  const rules = new Map(Object.entries(definitions).map(([name, rule]) => [name, { ...DEFAULT_RULES, ...rule }]));
  const items = new Map();
  const listeners = new Set();
  const views = new Map();

  const view = (name) => {
    if (!views.has(name)) {
      const rule = rules.get(name);
      const list = [...(items.get(name)?.values() ?? [])].sort((a, b) => a.order - b.order || a.seq - b.seq);
      views.set(name, rule?.kind === "single" ? list.slice(-1) : list.slice(0, rule?.max ?? Infinity));
    }
    return views.get(name);
  };

  const changed = (name) => {
    views.delete(name);
    for (const listener of listeners) listener(name);
  };

  let seq = 0;
  return {
    define(name, rule = {}) {
      rules.set(name, { ...DEFAULT_RULES, ...rule });
      changed(name);
    },
    add(name, item, owner) {
      const rule = rules.get(name);
      if (!rule) throw new SlotError("no-slot", `there is no slot ${name}`);
      if (typeof item?.id !== "string" || !item.id) throw new SlotError("bad-item", `an item in ${name} needs an id`);
      if (typeof item.component !== "function" && typeof item.component !== "object") throw new SlotError("bad-item", `${item.id} in ${name} has no component`);
      const bucket = items.get(name) ?? new Map();
      items.set(name, bucket);
      const mine = [...bucket.values()].filter((entry) => entry.owner === owner && entry.id !== item.id).length;
      if (mine >= rule.perPlugin) throw new SlotError("too-many", `${owner} already has ${rule.perPlugin} items in ${name}`);
      const previous = bucket.get(item.id);
      const entry = { ...item, order: Number.isFinite(item.order) ? item.order : 0, owner, seq: ++seq, replaces: previous?.owner !== owner ? previous?.owner : previous?.replaces };
      bucket.set(item.id, entry);
      changed(name);
      return () => {
        if (bucket.get(item.id) !== entry) return;
        if (previous && previous.owner !== owner) bucket.set(item.id, previous);
        else bucket.delete(item.id);
        changed(name);
      };
    },
    items: view,
    names: () => [...rules.keys()],
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
