import readline from "node:readline";

export function createPlugin(options = {}) {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const exit = options.exit ?? ((code) => process.exit(code));
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const wantedEvents = new Set();
  let context = null;
  const shutdownHandlers = [];
  let shuttingDown = null;

  const send = (message) => output.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const log = (message) => send({ method: "log", params: { message: String(message) } });

  const on = (method, handler) => {
    const list = listeners.get(method) ?? [];
    list.push(handler);
    listeners.set(method, list);
    return () => listeners.set(method, (listeners.get(method) ?? []).filter((item) => item !== handler));
  };

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send(params === undefined ? { id, method } : { id, method, params });
    });

  const hasCapability = (name) => Array.isArray(context?.capabilities) && context.capabilities.includes(name);

  const subscribe = (names) => {
    if (!hasCapability("events") || names.length === 0) return Promise.resolve();
    return call("events.subscribe", { events: names }).catch((error) => log(`Could not subscribe to ${names.join(", ")}: ${error.message}`));
  };

  const dispatch = (method, params) => {
    for (const handler of listeners.get(method) ?? []) {
      Promise.resolve()
        .then(() => handler(params))
        .catch((error) => log(`Handler for ${method} failed: ${error?.stack ?? error?.message ?? error}`));
    }
  };

  const lines = readline.createInterface({ input });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message === null || typeof message !== "object") return;
    if (message.id !== undefined && ("result" in message || "error" in message)) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        const error = Object.assign(new Error(message.error.message), { code: message.error.code, data: message.error.data });
        waiter?.reject(error);
      } else {
        waiter?.resolve(message.result);
      }
      return;
    }
    if (message.method === "initialize") {
      context = message.params ?? {};
      void subscribe([...wantedEvents]);
    }
    if (message.method === "shutdown") {
      shuttingDown ??= Promise.allSettled(shutdownHandlers.map((handler) => Promise.resolve().then(handler)));
      void shuttingDown.then(() => exit(0));
      return;
    }
    dispatch(message.method, message.params);
  });
  lines.on("close", () => void (shuttingDown ?? Promise.resolve()).then(() => exit(0)));

  const forView = (method, viewId, handler) => on(method, (params) => (params?.viewId === viewId ? handler(params) : undefined));

  return {
    call,
    log,
    on,
    get context() {
      return context;
    },
    hasCapability,
    onReady: (handler) => on("initialize", handler),
    onCommand: (id, handler) => on("command", (params) => (params?.id === id ? handler(params?.args ?? {}) : undefined)),
    onUri: (handler) => on("uri", handler),
    onSettingsChanged: (handler) => on("settings.changed", (params) => handler(params?.settings ?? {})),
    onShutdown: (handler) => {
      shutdownHandlers.push(handler);
    },
    onEvent: (name, handler) => {
      const off = on("event", (params) => (params?.name === name ? handler(params?.payload ?? {}) : undefined));
      if (!wantedEvents.has(name)) {
        wantedEvents.add(name);
        if (context) void subscribe([name]);
      }
      return off;
    },
    onNotificationAction: (id, handler) => on("notification.action", (params) => (params?.id === id ? handler() : undefined)),
    settings: () => call("settings.get"),
    setSettings: async (values) => (await call("settings.set", { values }))?.settings ?? {},
    setInfo: (items) => call("ui.setInfo", { items }),
    info: () => call("host.info"),
    notify: (title, options = {}) => call("island.notify", { title, ...options }),
    keepAlive: (reason) => call("host.keepAlive", { reason }),
    openView: (viewId) => call("island.openView", { viewId }),
    permissions: {
      request: (...names) =>
        call("permissions.request", { permissions: names.flat() }).then((result) => {
          if (context) context.permissions = [...new Set([...(context.permissions ?? []), ...(result?.granted ?? [])])];
          return result;
        }),
      has: (name) => Array.isArray(context?.permissions) && context.permissions.includes(name),
    },
    views: {
      update: (viewId, model) => call("view.update", { viewId, model }),
      patch: (viewId, change) => call("view.patch", Array.isArray(change) ? { viewId, items: change } : { ...change, viewId }),
      onVisible: (viewId, handler) => forView("view.visible", viewId, (params) => handler(Boolean(params.visible))),
      onAction: (viewId, handler) => forView("view.action", viewId, handler),
      onSubmit: (viewId, handler) => forView("view.submit", viewId, (params) => handler(params.values ?? {})),
      onSearch: (viewId, handler) => forView("view.search", viewId, (params) => handler(String(params.query ?? ""))),
      postMessage: (viewId, message) => call("webview.postMessage", { viewId, message }),
      onMessage: (viewId, handler) => forView("webview.message", viewId, (params) => handler(params.message)),
    },
    status: {
      update: (itemId, text, options = {}) => call("status.update", { itemId, text, ...options }),
      clear: (itemId) => call("status.update", { itemId, text: "" }),
    },
    storage: {
      get: async (key) => (await call("storage.get", { key }))?.value ?? null,
      set: (key, value) => call("storage.set", { key, value }),
      delete: async (key) => Boolean((await call("storage.delete", { key }))?.deleted),
      keys: async () => (await call("storage.keys"))?.keys ?? [],
    },
    secrets: {
      get: async (key) => (await call("secrets.get", { key }))?.value ?? null,
      set: (key, value) => call("secrets.set", { key, value }),
      delete: async (key) => Boolean((await call("secrets.delete", { key }))?.deleted),
    },
    todos: {
      list: (date) => call("todos.list", date ? { date } : undefined),
      days: (from, to) => call("todos.days", { from, to }),
      add: (title, date) => call("todos.add", date ? { title, date } : { title }),
      update: (id, changes) => call("todos.update", { ...changes, id }),
      remove: (id) => call("todos.remove", { id }),
    },
    note: {
      get: (date) => call("note.get", date ? { date } : undefined),
      set: (note) => call("note.set", { note }),
      append: (text) => call("note.set", { append: text }),
    },
    agentStatus: {
      report: (source, status) => call("agentStatus.report", { ...status, source }),
      clear: (source) => call("agentStatus.clear", source === undefined ? {} : { source }),
    },
    clipboard: { history: (limit) => call("clipboard.history", limit === undefined ? {} : { limit }) },
    messages: { list: () => call("messages.list") },
    media: {
      nowPlaying: () => call("media.nowPlaying"),
      playPause: () => call("media.playPause"),
      next: () => call("media.next"),
      previous: () => call("media.previous"),
      cover: () => call("media.cover"),
      seek: (positionMs) => call("media.seek", { positionMs }),
      setVolume: (level) => call("media.setVolume", { level }),
      toggleShuffle: () => call("media.toggleShuffle"),
      cycleRepeat: () => call("media.cycleRepeat"),
    },
    shelf: {
      list: () => call("shelf.list"),
      add: (paths) => call("shelf.add", { paths }),
      remove: (ids) => call("shelf.remove", { ids }),
    },
  };
}
