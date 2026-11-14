const STATES = ["pending", "loading", "running", "failed", "stopped", "unloading"];

function waitingFor(fiber) {
  const missing = [];
  for (const [name, meta] of Object.entries(fiber.inject ?? {})) {
    if (meta?.required === false) continue;
    if (!fiber.ctx.reflect._getImpl(name, true)) missing.push(name);
  }
  return missing;
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
  if (state === "failed") return { id, name, state, error: String(fiber._error?.stack ?? fiber._error ?? "") };
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
