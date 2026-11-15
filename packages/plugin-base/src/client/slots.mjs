const DEFAULT_RULES = { kind: "list", max: Infinity, perPlugin: 4 };
const SLOT_NAME = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\/v[1-9]\d*$/;

export const BUILTIN = "builtin";

export class SlotError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SlotError";
    this.code = code;
  }
}

export function slotWindow(name) {
  return SLOT_NAME.test(name) ? name.slice(0, name.search(/[./]/)) : null;
}

function checkRule(name, rule) {
  if (typeof name !== "string" || !SLOT_NAME.test(name)) throw new SlotError("bad-name", `a slot name is lowercase words joined by dots and ends with its version, like island.page/v1: ${String(name)}`);
  const merged = { ...DEFAULT_RULES, ...rule };
  if (merged.kind !== "list" && merged.kind !== "single") throw new SlotError("bad-rule", `${name} has an unknown kind: ${String(merged.kind)}`);
  if (merged.groupBy !== undefined && (typeof merged.groupBy !== "string" || merged.kind !== "list")) throw new SlotError("bad-rule", `${name} can only group a list slot, by a field name`);
  if (!(merged.max >= 1) || !(merged.perPlugin >= 1)) throw new SlotError("bad-rule", `${name} needs a max and a perPlugin of at least 1`);
  return merged;
}

const explicitOrder = (item) => (Number.isFinite(item.order) ? item.order : undefined);

function present(stack) {
  const top = stack[stack.length - 1];
  let order = 0;
  for (let at = stack.length - 1; at >= 0; at -= 1) {
    if (stack[at].order !== undefined) {
      order = stack[at].order;
      break;
    }
  }
  return { ...top, order, replaces: [...new Set(stack.slice(0, -1).map((entry) => entry.owner))], rank: stack[0].seq };
}

export function createSlots(definitions = {}) {
  const rules = new Map(Object.entries(definitions).map(([name, rule]) => [name, checkRule(name, rule)]));
  const stacks = new Map();
  const views = new Map();
  const listeners = new Set();
  let off = new Set();
  let seq = 0;

  const viewKey = (name, group) => (group === undefined ? name : `${name}\n${group}`);

  const view = (name, group) => {
    const key = viewKey(name, group);
    if (!views.has(key)) {
      const rule = rules.get(name);
      const all = [...(stacks.get(name)?.values() ?? [])]
        .map((stack) => (off.size === 0 ? stack : stack.filter((entry) => !off.has(entry.owner))))
        .filter((stack) => stack.length > 0)
        .map(present)
        .filter((entry) => group === undefined || entry[rule.groupBy] === group)
        .sort((a, b) => a.order - b.order || a.rank - b.rank)
        .map(({ rank, ...entry }) => entry);
      views.set(key, !rule ? [] : rule.kind === "single" ? all.slice(-1) : all.slice(0, rule.max));
    }
    return views.get(key);
  };

  const changed = (name, groups) => {
    if (groups === null) {
      for (const key of [...views.keys()]) if (key === name || key.startsWith(`${name}\n`)) views.delete(key);
    } else {
      views.delete(name);
      for (const group of groups) views.delete(viewKey(name, group));
    }
    for (const listener of listeners) listener(name);
  };

  const groupsOf = (rule, stack) => (rule.groupBy === undefined ? [] : stack.map((entry) => entry[rule.groupBy]));

  return {
    define(name, rule = {}) {
      rules.set(name, checkRule(name, rule));
      changed(name, null);
    },
    add(name, item, owner = BUILTIN, { external = owner !== BUILTIN } = {}) {
      const rule = rules.get(name);
      if (!rule) throw new SlotError("no-slot", `there is no slot ${name}`);
      if (typeof owner !== "string" || !owner) throw new SlotError("bad-item", `an item in ${name} needs an owner`);
      if (typeof item?.id !== "string" || !item.id) throw new SlotError("bad-item", `an item in ${name} needs an id`);
      if (typeof item.component !== "function" && (typeof item.component !== "object" || item.component === null)) throw new SlotError("bad-item", `${item.id} in ${name} has no component`);
      const group = rule.groupBy === undefined ? undefined : item[rule.groupBy];
      if (rule.groupBy !== undefined && (typeof group !== "string" || !group)) throw new SlotError("bad-item", `${item.id} in ${name} needs a ${rule.groupBy}`);
      const bucket = stacks.get(name) ?? new Map();
      if (external) {
        let mine = 0;
        for (const [id, stack] of bucket) {
          if (id !== item.id) mine += stack.filter((entry) => entry.owner === owner && (group === undefined || entry[rule.groupBy] === group)).length;
        }
        if (mine >= rule.perPlugin) throw new SlotError("too-many", `${owner} already has ${rule.perPlugin} items in ${name}${group === undefined ? "" : ` under ${group}`}`);
      }
      stacks.set(name, bucket);
      const stack = bucket.get(item.id) ?? [];
      const before = groupsOf(rule, stack);
      const entry = { ...item, order: explicitOrder(item), owner, seq: ++seq, external: Boolean(external) };
      const own = stack.findIndex((other) => other.owner === owner);
      if (own >= 0) stack[own] = entry;
      else stack.push(entry);
      bucket.set(item.id, stack);
      changed(name, [...before, group]);
      return () => {
        const at = stack.indexOf(entry);
        if (at < 0) return;
        stack.splice(at, 1);
        if (stack.length === 0 && bucket.get(item.id) === stack) bucket.delete(item.id);
        changed(name, [group, ...groupsOf(rule, stack)]);
      };
    },
    items: view,
    setDisabledOwners(owners) {
      const next = new Set(owners);
      if (next.size === off.size && [...next].every((owner) => off.has(owner))) return;
      off = next;
      for (const name of rules.keys()) changed(name, null);
    },
    disabledOwners: () => [...off],
    names: () => [...rules.keys()],
    rule: (name) => rules.get(name),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
