import { kindOf } from "./gate.mjs";
import { SOURCE } from "./sources.mjs";

const STATES = ["pending", "loading", "running", "failed", "stopped", "unloading"];
const IMPORT_ERROR = Symbol("plugin-base.importError");

export function trackImportErrors(ctx) {
  return ctx.on("loader/entry-init", (entry) => {
    const load = entry._import;
    const report = entry._reportImport;
    entry._import = function () {
      this[IMPORT_ERROR] = undefined;
      return load.call(this);
    };
    entry._reportImport = function (error) {
      this[IMPORT_ERROR] = error ?? new Error("the plugin did not load");
      return report.call(this, error);
    };
  });
}

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

function describe(entry, logs, gate) {
  const { id, name } = entry.options;
  const fiber = entry.innerFiber ?? entry.outerFiber;
  if (entry.options.disabled === true) return { id, name, state: "disabled" };
  const verdict = gate?.verdict(entry);
  if (verdict && !fiber?.uid) return { id, name, state: verdict.state, reason: verdict.reason, blocked: verdict.blocked };
  if (!fiber) {
    if (entry._initTask) return { id, name, state: "loading" };
    if (entry[IMPORT_ERROR]) return { id, name, state: "failed", error: String(entry[IMPORT_ERROR]?.stack ?? entry[IMPORT_ERROR]) };
    const file = name.replace(/^\.\//, "");
    const failure = [...logs].reverse().find((log) => log.type === "error" && log.text.includes(file));
    return { id, name, state: "failed", error: failure?.text ?? "the plugin did not load" };
  }
  const state = STATES[fiber.state] ?? "pending";
  if (state === "failed") return { id, name, state, error: explain(entry, fiber._error) };
  if (state === "pending") return { id, name, state: "waiting", waitingFor: waitingFor(fiber) };
  return { id, name, state };
}

export const INTERNAL = new Set([new URL("./plugins-file.mjs", import.meta.url).href, import.meta.resolve("@cordisjs/hmr")]);

function undeclaredOf(entry, services, clients) {
  const declared = entry.options[SOURCE]?.declared;
  if (!declared) return null;
  const { id } = entry.options;
  const found = {
    provides: services.filter((service) => service.plugin === id && !declared.provides.includes(service.name)).map((service) => service.name),
    client: [...new Set(clients.filter((client) => client.plugin === id && !declared.client.includes(client.window)).map((client) => client.window))],
  };
  const listed = Object.entries(found).filter(([, names]) => names.length > 0);
  return listed.length ? Object.fromEntries(listed) : null;
}

export function pluginStatus(ctx, logs = [], { gate, usage, services, clients } = {}) {
  const report = usage?.();
  const provided = services?.() ?? [];
  const windows = clients?.() ?? [];
  return [...ctx.loader.entries()]
    .map((entry) => ({ internal: INTERNAL.has(entry.options.name), entry, status: describe(entry, logs, gate) }))
    .filter(({ internal, status }) => !internal || status.state !== "running")
    .map(({ internal, entry, status }) => {
      if (internal) return status;
      const extra = { kind: kindOf(entry.options), source: entry.options[SOURCE]?.source ?? "file" };
      if (report) extra.usage = report(status.id);
      const last = gate?.report(status.id).last;
      if (last) extra.lastError = last;
      const undeclared = undeclaredOf(entry, provided, windows);
      if (undeclared) extra.undeclared = undeclared;
      return { ...status, ...extra };
    });
}

export function watchStatus(ctx, logs, onChange, { delayMs = 20, tickMs = 0, gate, usage, services, clients, subscribe } = {}) {
  const read = () => pluginStatus(ctx, logs, { gate, usage, services, clients });
  let last = JSON.stringify(read());
  let timer = null;
  const check = () => {
    timer = null;
    const status = read();
    const text = JSON.stringify(status);
    if (text === last) return;
    last = text;
    onChange(status);
  };
  const schedule = () => {
    timer ??= setTimeout(check, delayMs);
  };
  const off = [ctx.on("internal/status", schedule), ctx.on("internal/plugin", schedule), ctx.on("loader/entry-init", schedule), ctx.on("plugin-base/gate", schedule), ...(subscribe?.(schedule) ?? [])];
  const tick = tickMs > 0 ? setInterval(schedule, tickMs) : null;
  tick?.unref?.();
  return () => {
    clearTimeout(timer);
    clearInterval(tick);
    off.forEach((dispose) => dispose());
  };
}
