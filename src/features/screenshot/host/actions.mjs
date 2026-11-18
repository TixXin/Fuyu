const ACTION_ID = /^[a-z][a-z0-9._-]{0,62}$/;
const ICONS = new Set(["inbox", "bot", "sparkles", "share", "copy", "pin", "wand"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function actionError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

function normalizeLabel(value, field) {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    return { "zh-CN": text, en: text };
  }
  if (isObject(value) && typeof value["zh-CN"] === "string" && value["zh-CN"].trim() && typeof value.en === "string" && value.en.trim()) {
    return { "zh-CN": value["zh-CN"].trim(), en: value.en.trim() };
  }
  throw actionError("bad-params", `${field} must be a non-empty string or { "zh-CN", en }`);
}

function normalizeRunResult(result) {
  if (typeof result === "string" && result.trim()) {
    return { message: result.trim(), dismiss: false };
  }
  if (isObject(result)) {
    const message = typeof result.message === "string" && result.message.trim() ? result.message.trim() : null;
    return { message, dismiss: result.dismiss === true };
  }
  return { message: null, dismiss: false };
}

export function createScreenshotActionRegistry() {
  const actions = new Map();
  const listeners = new Set();
  let seq = 0;

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  }

  return {
    register(spec) {
      if (!isObject(spec) || typeof spec.id !== "string" || !ACTION_ID.test(spec.id)) {
        throw actionError("bad-params", "a screenshot action needs an id matching /^[a-z][a-z0-9._-]{0,62}$/");
      }
      if (actions.has(spec.id)) {
        throw actionError("conflict", `screenshot action ${spec.id} is already registered`, { id: spec.id });
      }
      if (typeof spec.run !== "function") {
        throw actionError("bad-params", `screenshot action ${spec.id} must provide a run function`);
      }
      const label = normalizeLabel(spec.label, `screenshot action ${spec.id} label`);
      const disabledTitle = spec.disabledTitle === undefined ? undefined : normalizeLabel(spec.disabledTitle, `screenshot action ${spec.id} disabledTitle`);
      const icon = typeof spec.icon === "string" && ICONS.has(spec.icon) ? spec.icon : "sparkles";
      const order = typeof spec.order === "number" && Number.isFinite(spec.order) ? spec.order : 100;
      const entry = {
        id: spec.id,
        label,
        disabledTitle,
        icon,
        order,
        seq: ++seq,
        disabled: spec.disabled,
        run: async (context) => {
          if (!isObject(context) || typeof context.path !== "string" || !context.path.trim()) {
            throw actionError("bad-params", `screenshot action ${spec.id} needs { path }`);
          }
          const result = await spec.run({
            path: context.path,
            saved: context.saved === true,
            thumbnail: typeof context.thumbnail === "string" ? context.thumbnail : null,
            text: typeof context.text === "string" ? context.text : null,
          });
          return normalizeRunResult(result);
        },
      };
      actions.set(entry.id, entry);
      notify();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (actions.get(entry.id) === entry) {
          actions.delete(entry.id);
          notify();
        }
      };
    },

    has(id) {
      return typeof id === "string" && actions.has(id);
    },

    get(id) {
      return typeof id === "string" ? actions.get(id) ?? null : null;
    },

    list() {
      return [...actions.values()]
        .sort((a, b) => a.order - b.order || a.seq - b.seq)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          ...(entry.disabledTitle ? { disabledTitle: entry.disabledTitle } : {}),
          icon: entry.icon,
          order: entry.order,
          disabled: typeof entry.disabled === "function" ? Boolean(entry.disabled()) : entry.disabled === true,
        }));
    },

    async run(id, context) {
      const entry = typeof id === "string" ? actions.get(id) : null;
      if (!entry) throw actionError("not-found", `screenshot action ${String(id)} is not registered`, { id });
      const isDisabled = typeof entry.disabled === "function" ? Boolean(entry.disabled()) : entry.disabled === true;
      if (isDisabled) throw actionError("disabled", `screenshot action ${entry.id} is currently disabled`, { id: entry.id });
      return entry.run(context);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const screenshotActions = createScreenshotActionRegistry();
export const registerScreenshotAction = (spec) => screenshotActions.register(spec);
export const subscribeScreenshotActions = (listener) => screenshotActions.subscribe(listener);
