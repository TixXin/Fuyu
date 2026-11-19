const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const NOTICE_KEYS = new Set(["source", "pluginId", "title", "body", "receivedAt", "durationMs", "iconUrl", "layout", "controls", "actions"]);

export const BUILTIN_MESSAGE_SOURCES = Object.freeze([
  Object.freeze({ id: "qq", label: Object.freeze({ zh: "QQ", en: "QQ" }), builtin: true, order: 10 }),
  Object.freeze({ id: "wechat", label: Object.freeze({ zh: "微信", en: "WeChat" }), builtin: true, order: 20 }),
  Object.freeze({ id: "qqMail", label: Object.freeze({ zh: "邮箱", en: "Mail" }), builtin: true, order: 30 }),
  Object.freeze({ id: "telegram", label: Object.freeze({ zh: "Telegram", en: "Telegram" }), builtin: true, enabled: false, order: 40 }),
  Object.freeze({ id: "discord", label: Object.freeze({ zh: "Discord", en: "Discord" }), builtin: true, enabled: false, order: 45 }),
  Object.freeze({ id: "whatsapp", label: Object.freeze({ zh: "WhatsApp", en: "WhatsApp" }), builtin: true, enabled: false, order: 50 }),
  Object.freeze({ id: "tim", label: Object.freeze({ zh: "TIM", en: "TIM" }), builtin: true, enabled: false, order: 55 }),
  Object.freeze({ id: "feishu", label: Object.freeze({ zh: "飞书", en: "Feishu" }), builtin: true, enabled: false, order: 60 }),
  Object.freeze({ id: "dingtalk", label: Object.freeze({ zh: "钉钉", en: "DingTalk" }), builtin: true, enabled: false, order: 65 }),
  Object.freeze({ id: "wecom", label: Object.freeze({ zh: "企业微信", en: "WeCom" }), builtin: true, enabled: false, order: 70 }),
]);

function messagesError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function normalizeArrivalNotice(raw, now = Date.now()) {
  if (!isObject(raw) || !Object.keys(raw).every((key) => NOTICE_KEYS.has(key))) {
    throw messagesError("bad-params", "messages/v1 notify takes { source, title, body, pluginId?, receivedAt?, durationMs?, iconUrl?, layout?, controls?, actions? }");
  }
  if (typeof raw.source !== "string" || raw.source.trim() === "") {
    throw messagesError("bad-params", "messages/v1 notify requires a non-empty string source");
  }
  if (typeof raw.title !== "string" || raw.title.trim() === "" || typeof raw.body !== "string") {
    throw messagesError("bad-params", "messages/v1 notify requires a non-empty string title and a string body");
  }
  const receivedAt = typeof raw.receivedAt === "number" && Number.isFinite(raw.receivedAt) ? Math.floor(raw.receivedAt) : now;
  const durationMs = typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs) && raw.durationMs > 0 ? Math.floor(raw.durationMs) : 5000;
  const actions = Array.isArray(raw.actions) ? raw.actions.filter((item) => typeof item === "string" && item.trim() !== "") : [];
  return Object.freeze({
    source: raw.source.trim(),
    pluginId: typeof raw.pluginId === "string" && raw.pluginId.trim() !== "" ? raw.pluginId.trim() : raw.source.trim(),
    title: raw.title,
    body: raw.body,
    receivedAt,
    durationMs,
    iconUrl: typeof raw.iconUrl === "string" && raw.iconUrl.trim() !== "" ? raw.iconUrl : null,
    layout: raw.layout === "inline" ? "inline" : "default",
    controls: raw.controls === "media" ? "media" : "none",
    actions,
  });
}

export function clearParamsOf(params) {
  if (params === undefined || params === null) return { source: undefined };
  if (!isObject(params) || !Object.keys(params).every((key) => key === "source") || (params.source !== undefined && (typeof params.source !== "string" || params.source.trim() === ""))) {
    throw messagesError("bad-params", "messages/v1 clear takes { source?: string }");
  }
  return { source: typeof params.source === "string" ? params.source.trim() : undefined };
}

function validateSource(spec) {
  if (!isObject(spec) || typeof spec.id !== "string" || spec.id.trim() === "") {
    throw messagesError("bad-params", "messageSources.register needs a non-empty string id");
  }
  const hasLabel =
    typeof spec.label === "string" ||
    (isObject(spec.label) && typeof spec.label.zh === "string" && typeof spec.label.en === "string");
  if (!hasLabel) {
    throw messagesError("bad-params", `message source ${spec.id} needs a label (string or { zh, en })`);
  }
  const id = spec.id.trim();
  const builtinDef = BUILTIN_MESSAGE_SOURCES.find((item) => item.id === id);
  return Object.freeze({
    id,
    label: spec.label,
    builtin: spec.builtin === true,
    pluginId: typeof spec.pluginId === "string" && spec.pluginId.trim() !== "" ? spec.pluginId.trim() : undefined,
    enabled: spec.enabled !== false,
    order: typeof spec.order === "number" && Number.isFinite(spec.order) ? spec.order : builtinDef ? builtinDef.order : 100,
    status: typeof spec.status === "function" ? spec.status : undefined,
    clear: typeof spec.clear === "function" ? spec.clear : undefined,
    open: typeof spec.open === "function" ? spec.open : undefined,
  });
}

function configuredBuiltin(builtin, config) {
  if (!isObject(config)) return builtin;
  const key = builtin.id === "qqMail" ? "mail" : builtin.id;
  return typeof config[key] === "boolean" ? { ...builtin, enabled: config[key] } : builtin;
}

export function createMessageSourceRegistry({ onChange, onArrive, config } = {}) {
  const stacks = new Map();
  const counts = new Map();
  const listeners = new Set();
  if (typeof onChange === "function") listeners.add(onChange);

  for (const builtin of BUILTIN_MESSAGE_SOURCES) {
    stacks.set(builtin.id, [{ token: Symbol(builtin.id), spec: validateSource(configuredBuiltin(builtin, config)) }]);
  }

  let snapshot = Object.freeze([]);

  const buildStatus = (spec, isReplacedBuiltin) => {
    let customStatus = null;
    if (spec.status) {
      try {
        customStatus = spec.status();
      } catch {}
    }
    const runtimeCount = counts.get(spec.id) ?? 0;
    const unreadCount =
      typeof customStatus?.unreadCount === "number" && Number.isFinite(customStatus.unreadCount)
        ? Math.max(0, Math.floor(customStatus.unreadCount))
        : runtimeCount;
    const pending = typeof customStatus?.pending === "boolean" ? customStatus.pending : unreadCount > 0;
    const enabled = typeof customStatus?.enabled === "boolean" ? customStatus.enabled : spec.enabled !== false;
    return Object.freeze({
      id: spec.id,
      label: spec.label,
      builtin: isReplacedBuiltin || spec.builtin === true,
      enabled,
      unreadCount,
      pending,
      order: spec.order,
      ...(isReplacedBuiltin && !spec.builtin ? { replacedBy: spec.pluginId ?? spec.id } : {}),
    });
  };

  const rebuild = () => {
    const items = [];
    for (const [id, stack] of stacks.entries()) {
      if (stack.length === 0) continue;
      const top = stack[stack.length - 1].spec;
      const isBuiltinId = BUILTIN_MESSAGE_SOURCES.some((item) => item.id === id);
      items.push(buildStatus(top, isBuiltinId));
    }
    items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    snapshot = Object.freeze(items);
  };

  rebuild();

  const notify = () => {
    rebuild();
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  };

  return Object.freeze({
    register(rawSpec) {
      const spec = validateSource(rawSpec);
      const token = Symbol(spec.id);
      const stack = stacks.get(spec.id) ?? [];
      stack.push({ token, spec });
      stacks.set(spec.id, stack);
      notify();
      return () => {
        const current = stacks.get(spec.id);
        if (!current) return;
        const idx = current.findIndex((entry) => entry.token === token);
        if (idx === -1) return;
        current.splice(idx, 1);
        if (current.length === 0) stacks.delete(spec.id);
        notify();
      };
    },
    sources() {
      rebuild();
      return { sources: snapshot };
    },
    snapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify(rawNotice) {
      const notice = normalizeArrivalNotice(rawNotice);
      counts.set(notice.source, (counts.get(notice.source) ?? 0) + 1);
      let shown = true;
      let showing = null;
      if (typeof onArrive === "function") {
        try {
          const res = onArrive(notice);
          if (typeof res === "boolean") shown = res;
          else if (typeof res?.then === "function") showing = res;
        } catch {}
      }
      notify();
      if (!showing) return { shown, receivedAt: notice.receivedAt };
      return Promise.resolve(showing).then(
        (value) => ({ shown: value === true, receivedAt: notice.receivedAt }),
        () => ({ shown: false, receivedAt: notice.receivedAt }),
      );
    },
    async clear(rawParams) {
      const { source } = clearParamsOf(rawParams);
      if (source) {
        counts.delete(source);
        const stack = stacks.get(source);
        const top = stack?.[stack.length - 1]?.spec;
        if (top?.clear) await top.clear();
      } else {
        counts.clear();
        for (const stack of stacks.values()) {
          const top = stack[stack.length - 1]?.spec;
          if (top?.clear) await top.clear();
        }
      }
      notify();
      return { ok: true };
    },
    refresh() {
      notify();
    },
    resetForTest() {
      stacks.clear();
      counts.clear();
      for (const builtin of BUILTIN_MESSAGE_SOURCES) {
        stacks.set(builtin.id, [{ token: Symbol(builtin.id), spec: validateSource(configuredBuiltin(builtin, config)) }]);
      }
      notify();
    },
  });
}

let arrivalHandler = null;
const defaultRegistry = createMessageSourceRegistry({
  onArrive: (notice) => (typeof arrivalHandler === "function" ? arrivalHandler(notice) : true),
});

export function setMessageArrivalHandler(handler) {
  arrivalHandler = handler;
}

export function registerMessageSource(spec) {
  return defaultRegistry.register(spec);
}

export function getMessageSources() {
  return defaultRegistry.sources();
}

export function getMessageSourcesSnapshot() {
  return defaultRegistry.snapshot();
}

export function subscribeMessageSources(listener) {
  return defaultRegistry.subscribe(listener);
}

export function notifyMessageArrival(notice) {
  return defaultRegistry.notify(notice);
}

export function clearMessageSources(params) {
  return defaultRegistry.clear(params);
}

export function refreshMessageSources() {
  defaultRegistry.refresh();
}

export function resetMessageSourcesForTest() {
  defaultRegistry.resetForTest();
}
