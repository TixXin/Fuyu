const STATES = ["pending", "loading", "running", "failed", "stopped", "unloading"];

function waitingFor(fiber) {
  const missing = [];
  for (const [name, meta] of Object.entries(fiber.inject ?? {})) {
    if (meta?.required === false) continue;
    if (!fiber.ctx.reflect._getImpl(name, true)) missing.push(name);
  }
  return missing;
}

function providerOf(ctx, impl) {
  return [...ctx.loader.entries()].find((entry) => entry.innerFiber?.provisions?.has(impl) || entry.outerFiber?.provisions?.has(impl)) ?? null;
}

function explain(entry, error) {
  const text = String(error?.stack ?? error ?? "");
  const service = /service "([^"]+)" has been registered/.exec(text)?.[1];
  if (!service) return text;
  const impl = entry.ctx.reflect._getImpl(service, false);
  const owner = impl && providerOf(entry.ctx, impl);
  return owner ? `the service "${service}" is already provided by the plugin "${owner.options.id}" (${owner.options.name})\n${text}` : text;
}

function describe(entry, logs) {
  const { id, name } = entry.options;
  const fiber = entry.innerFiber ?? entry.outerFiber;
  if (entry.options.disabled === true) return { id, name, state: "disabled" };
  if (!fiber) {
    const file = name.replace(/^\.\//, "");
    const failure = [...logs].reverse().find((log) => log.type === "error" && log.text.includes(file));
    if (entry._initTask) return { id, name, state: "loading" };
    return { id, name, state: "failed", error: failure?.text ?? "the plugin did not load" };
  }
  const state = STATES[fiber.state] ?? "pending";
  if (state === "failed") return { id, name, state, error: explain(entry, fiber._error) };
  if (state === "pending") return { id, name, state: "waiting", waitingFor: waitingFor(fiber) };
  return { id, name, state };
}

const INTERNAL = new Set([import.meta.resolve("@cordisjs/include"), import.meta.resolve("@cordisjs/hmr")]);

export function pluginStatus(ctx, logs = []) {
  return [...ctx.loader.entries()]
    .map((entry) => ({ internal: INTERNAL.has(entry.options.name), status: describe(entry, logs) }))
    .filter(({ internal, status }) => !internal || status.state !== "running")
    .map(({ status }) => status);
}

export function watchStatus(ctx, logs, onChange, delayMs = 20) {
  let last = JSON.stringify(pluginStatus(ctx, logs));
  let timer = null;
  const check = () => {
    timer = null;
    const status = pluginStatus(ctx, logs);
    const text = JSON.stringify(status);
    if (text === last) return;
    last = text;
    onChange(status);
  };
  const schedule = () => {
    timer ??= setTimeout(check, delayMs);
  };
  const off = [ctx.on("internal/status", schedule), ctx.on("internal/plugin", schedule), ctx.on("loader/entry-init", schedule)];
  return () => {
    clearTimeout(timer);
    off.forEach((dispose) => dispose());
  };
}
