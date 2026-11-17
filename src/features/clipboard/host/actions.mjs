const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const VALID_GROUPS = new Set(["paste", "entry", "record"]);

function actionError(code, message) {
  return Object.assign(new Error(message), { code });
}

function validateAction(spec) {
  if (!isObject(spec) || typeof spec.id !== "string" || spec.id.trim() === "") {
    throw actionError("bad-params", "clipboardActions.register needs a non-empty string id");
  }
  if (typeof spec.run !== "function") {
    throw actionError("bad-params", `clipboard action ${spec.id} needs a run(context) function`);
  }
  const hasLabel =
    typeof spec.label === "function" ||
    (isObject(spec.label) && typeof spec.label.zh === "string" && typeof spec.label.en === "string");
  if (!hasLabel) {
    throw actionError("bad-params", `clipboard action ${spec.id} needs a label ({ zh, en } or function)`);
  }
  if (spec.match !== undefined && typeof spec.match !== "function") {
    throw actionError("bad-params", `clipboard action ${spec.id} match must be a function when given`);
  }
  const group = VALID_GROUPS.has(spec.group) ? spec.group : "entry";
  const keywords = Array.isArray(spec.keywords)
    ? spec.keywords.filter((word) => typeof word === "string" && word.trim() !== "")
    : [];
  return Object.freeze({
    id: spec.id.trim(),
    label: spec.label,
    note: spec.note,
    icon: typeof spec.icon === "string" && spec.icon.trim() !== "" ? spec.icon.trim() : "wand",
    group,
    keywords: Object.freeze(keywords),
    order: typeof spec.order === "number" && Number.isFinite(spec.order) ? spec.order : 100,
    match: spec.match,
    run: spec.run,
  });
}

export function resolveClipboardActionLabel(label, locale = "zh") {
  if (typeof label === "function") return String(label(locale) ?? "");
  if (typeof label === "string") return label;
  if (isObject(label)) return String(label[locale] ?? label.zh ?? label.en ?? "");
  return "";
}

export function createClipboardActionRegistry({ onChange } = {}) {
  const entries = new Map();
  const listeners = new Set();
  if (typeof onChange === "function") listeners.add(onChange);
  let snapshot = Object.freeze([]);

  const rebuild = () => {
    snapshot = Object.freeze(
      [...entries.values()]
        .sort((a, b) => a.spec.order - b.spec.order || a.spec.id.localeCompare(b.spec.id))
        .map((entry) => entry.spec),
    );
  };

  const notify = () => {
    rebuild();
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  };

  const list = () => snapshot;

  return Object.freeze({
    register(rawSpec) {
      const spec = validateAction(rawSpec);
      const token = Symbol(spec.id);
      entries.set(spec.id, { token, spec });
      notify();
      return () => {
        const current = entries.get(spec.id);
        if (!current || current.token !== token) return;
        entries.delete(spec.id);
        notify();
      };
    },
    list,
    forItem(item) {
      if (!item) return [];
      const matched = [];
      for (const spec of list()) {
        try {
          if (!spec.match || spec.match(item) === true) matched.push(spec);
        } catch {}
      }
      return matched;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async run(id, context) {
      const entry = entries.get(id);
      if (!entry) throw actionError("not-found", `clipboard action ${id} is not registered`);
      return await entry.spec.run(context);
    },
    clear() {
      if (entries.size === 0) return;
      entries.clear();
      notify();
    },
  });
}

const defaultRegistry = createClipboardActionRegistry();

export function registerClipboardAction(spec) {
  return defaultRegistry.register(spec);
}

export function getClipboardActions() {
  return defaultRegistry.list();
}

export function getClipboardActionsForItem(item) {
  return defaultRegistry.forItem(item);
}

export function subscribeClipboardActions(listener) {
  return defaultRegistry.subscribe(listener);
}

export function runClipboardAction(id, context) {
  return defaultRegistry.run(id, context);
}

export function clearClipboardActionsForTest() {
  defaultRegistry.clear();
}
