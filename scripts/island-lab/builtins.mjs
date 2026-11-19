const USAGE_KEYS = ["timers", "listeners", "services", "clients"];

const windowsOf = (diagnostics) => (Array.isArray(diagnostics?.windows) ? diagnostics.windows : []);
const entryOf = (report, id) => (Array.isArray(report?.plugins) ? report.plugins.find((plugin) => plugin.id === id) : undefined);

export function switchable(diagnostics) {
  const plugins = Array.isArray(diagnostics?.rust) ? diagnostics.rust : [];
  return plugins.filter((plugin) => plugin.kind !== "essential" && plugin.enabled).map((plugin) => plugin.id);
}

export function residueOf(id, settled, later) {
  const left = [];
  const rust = (Array.isArray(later?.rust) ? later.rust : []).find((plugin) => plugin.id === id);
  if (rust?.enabled) left.push("开关没关上");
  for (const background of rust?.background ?? []) {
    if (background.running) left.push(`Rust 后台 ${background.name} 还在跑`);
  }
  const host = later?.host?.running ? (later.host.plugins ?? []).find((plugin) => plugin.id === id) : undefined;
  if (host && host.state !== "disabled") left.push(`宿主里是 ${host.state}`);
  for (const key of USAGE_KEYS) {
    if ((host?.usage?.[key] ?? 0) > 0) left.push(`宿主 ${key} ${host.usage[key]}`);
  }
  for (const report of windowsOf(later)) {
    const now = entryOf(report, id);
    if (!now) continue;
    const before = entryOf(windowsOf(settled).find((other) => other.window === report.window), id);
    if (now.items > 0) left.push(`${report.window} 窗口还有 ${now.items} 个插槽项`);
    if (now.listening > 0) left.push(`${report.window} 窗口还在听 ${now.listening} 个事件`);
    if (now.services > 0) left.push(`${report.window} 窗口还提供 ${now.services} 个服务`);
    const calls = now.calls - (before?.calls ?? now.calls);
    if (calls > 0) left.push(`${report.window} 窗口关掉后又调了 ${calls} 次命令`);
  }
  return left;
}

export function threadsLine(before, after) {
  if (typeof before !== "number" || typeof after !== "number") return "—";
  return `${before} → ${after}${after < before ? `（少 ${before - after}）` : after > before ? `（多 ${after - before}）` : ""}`;
}

export async function sweep(call, { settleMs = 1200, watchMs = 3000, onRow = () => {}, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const start = await call("GET", "builtins");
  const rows = [];
  for (const id of switchable(start)) {
    const before = await call("GET", "builtins");
    if (!switchable(before).includes(id)) continue;
    await call("PUT", `builtins/${id}`, { enabled: false });
    try {
      await pause(settleMs);
      const settled = await call("GET", "builtins");
      await pause(watchMs);
      const later = await call("GET", "builtins");
      const row = { id, left: residueOf(id, settled, later), threads: threadsLine(before.threads, later.threads) };
      rows.push(row);
      onRow(row);
    } finally {
      await call("PUT", `builtins/${id}`, { enabled: true });
      await pause(settleMs);
    }
  }
  return rows;
}
