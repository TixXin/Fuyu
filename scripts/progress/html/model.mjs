export const STATUSES = ["waiting", "running", "background", "done", "idle"];
export const STATUS_LABEL = { running: "在跑", background: "后台跑", waiting: "等你", done: "做完", idle: "闲着" };
const ACTIVE = ["waiting", "running", "background"];
const ORDER = Object.fromEntries(STATUSES.map((s, i) => [s, i]));
const MARKER_STATUS = { "↩": "waiting", "⋯": "background", "✓": "done" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function inferKind(title) {
  if (/^(?:Fuyu-)?\[(?:总控|长期任务)\]/.test(title)) return "controller";
  if (/^\[任务\]/.test(title)) return "lead";
  if (/^\[[A-Z]\d+(?:\.\d+)*\]/.test(title)) return "task";
  return "other";
}

export function deriveStatus(session) {
  if (STATUSES.includes(session.status)) return session.status;
  if (session.isRunning) return "running";
  return MARKER_STATUS[String(session.marker ?? "").trim()] ?? "idle";
}

function parseTitle(title) {
  const task = title.match(/^\[([A-Z]\d+(?:\.\d+)*)\]\s*(.*)$/);
  if (task) return { id: task[1], short: task[2] || title };
  const group = title.match(/^(?:Fuyu-)?\[(?:任务|总控|长期任务)\]\s*(.*)$/);
  return { id: null, short: group?.[1] || title };
}

export function normalizeSessions(raw = []) {
  return raw.map((s, index) => {
    const title = String(s.title ?? s.name ?? `会话 ${index + 1}`);
    return {
      key: String(s.sessionId ?? s.id ?? `#${index}`),
      name: String(s.name ?? ""),
      title,
      kind: ["controller", "lead", "task"].includes(s.kind) ? s.kind : inferKind(title),
      parent: s.parent ?? s.startedBy ?? null,
      status: deriveStatus(s),
      ask: s.ask ? String(s.ask) : "",
      note: s.note ? String(s.note) : "",
      ...parseTitle(title),
    };
  });
}

export function byStatus(a, b) {
  return ORDER[a.status] - ORDER[b.status];
}

export function aggregate(list) {
  if (list.some((s) => s.status === "waiting")) return "waiting";
  if (list.some((s) => s.status === "running" || s.status === "background")) return "running";
  return "idle";
}

function buildLanes(sessions) {
  const index = new Map();
  for (const s of sessions) for (const k of [s.key, s.title, s.name]) if (k && !index.has(k)) index.set(k, s);
  const up = (s) => (s.parent ? index.get(s.parent) ?? null : null);
  const lanes = new Map();
  const other = { key: "~other", title: "其他", short: "其他", kind: "controller", status: "idle", synthetic: true, ask: "", note: "" };
  const laneOf = (ctl) => {
    if (!lanes.has(ctl.key)) lanes.set(ctl.key, { ctl, groups: new Map() });
    return lanes.get(ctl.key);
  };
  const groupOf = (lane, lead) => {
    const k = lead ? lead.key : "~direct";
    if (!lane.groups.has(k)) lane.groups.set(k, { lead, tasks: [] });
    return lane.groups.get(k);
  };
  for (const s of sessions) if (s.kind === "controller") laneOf(s);
  const findUp = (s, kinds) => {
    const seen = new Set([s.key]);
    for (let x = up(s); x && !seen.has(x.key); x = up(x)) {
      if (kinds.includes(x.kind)) return x;
      seen.add(x.key);
    }
    return null;
  };
  for (const s of sessions.filter((x) => x.kind === "lead")) groupOf(laneOf(findUp(s, ["controller"]) ?? other), s);
  for (const s of sessions.filter((x) => x.kind === "task" || x.kind === "other")) {
    const owner = findUp(s, ["lead", "controller"]);
    if (owner?.kind === "lead") groupOf(laneOf(findUp(owner, ["controller"]) ?? other), owner).tasks.push(s);
    else groupOf(laneOf(owner ?? other), null).tasks.push(s);
  }
  return [...lanes.values()].map(({ ctl, groups }) => {
    const list = [...groups.values()].map((g) => ({ ...g, tasks: g.tasks.sort(byStatus) }));
    list.sort((a, b) => (a.lead ? 1 : 0) - (b.lead ? 1 : 0));
    const members = list.flatMap((g) => (g.lead ? [g.lead, ...g.tasks] : g.tasks));
    const all = ctl.synthetic ? members : [ctl, ...members];
    const own = !ctl.synthetic && ACTIVE.includes(ctl.status) ? ctl : null;
    return { ctl, own, groups: list, members, status: aggregate(all), size: members.length };
  });
}

export function formatters(tz) {
  const zone = tz || undefined;
  const hm = new Intl.DateTimeFormat("zh-CN", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
  const weekday = new Intl.DateTimeFormat("zh-CN", { timeZone: zone, weekday: "short" });
  return {
    hm: (d) => hm.format(new Date(d)),
    ymd: (d) => ymd.format(new Date(d)),
    hours: (d) => { const [h, m] = hour.format(new Date(d)).split(":").map(Number); return (h % 24) + m / 60; },
    weekday: (d) => weekday.format(new Date(d)),
  };
}

function prFailed(pr) {
  return (pr.state ?? []).some((x) => String(x).includes("没过"));
}

export function buildModel(data) {
  const progress = data.progress ?? {};
  const now = new Date(progress.generatedAt ?? data.generatedAt ?? Date.now());
  const fmt = formatters(data.tz);
  const today = fmt.ymd(now);
  const sessions = normalizeSessions(data.sessions);
  const lanes = buildLanes(sessions).filter((l) => l.size || l.own);
  lanes.sort((a, b) => byStatus(a, b) || b.size - a.size);
  const calm = sessions.filter((s) => s.kind === "controller" && !lanes.some((l) => l.ctl === s)).map((s) => s.short);
  const laneOf = new Map(lanes.flatMap((l) => l.groups.flatMap((g) => [...(g.lead ? [[g.lead.key, { lane: l, group: g }]] : []), ...g.tasks.map((t) => [t.key, { lane: l, group: g }])])));
  const where = (s) => {
    const hit = laneOf.get(s.key);
    if (!hit) return "";
    return [hit.group.lead && hit.group.lead !== s ? hit.group.lead.short : "", hit.lane.ctl.synthetic ? "" : hit.lane.ctl.short].filter(Boolean).join(" · ");
  };
  const label = (s) => (s.id ? `${s.id} ${s.short}` : s.short);
  const openPrs = progress.prs?.list ?? [];
  const doneIssues = progress.issues?.list ?? [];
  const asks = [
    ...sessions.filter((s) => s.status === "waiting").map((s) => ({ key: s.key, kind: "会话", cls: "", title: label(s), detail: s.ask || "等你回复", from: where(s) })),
    ...openPrs.filter(prFailed).map((p) => ({ kind: "PR", cls: "pr", title: `#${p.number} ${p.title}`, detail: (p.state ?? []).join("、"), from: p.author ?? "" })),
    ...doneIssues.filter((row) => row.merged).map((row) => ({ kind: "issue", cls: "pr", title: `#${row.issue} ${row.title ?? ""}`.trim(), detail: "已合入，issue 还没回复关闭", from: (row.ids ?? []).join("、") })),
  ];
  const forUser = progress.forUser ?? [];
  const testItem = forUser.length
    ? { kind: "实测", cls: "test", title: `${forUser.length} 项等你实测`, detail: forUser.slice(0, 4).map((t) => t.id).join("、") + (forUser.length > 4 ? " 等" : ""), from: "" }
    : null;
  const mergedSrc = data.mergedPrs ?? [];
  const closedSrc = data.closedIssues ?? [];
  const merged = mergedSrc.filter((p) => p.mergedAt && fmt.ymd(p.mergedAt) === today).sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
  const closed = closedSrc.filter((p) => p.closedAt && fmt.ymd(p.closedAt) === today);
  const cap = (list, src) => (list.length && list.length === src.length ? `${list.length}+` : String(list.length));
  const inProgress = progress.inProgress ?? [];
  const linked = new Set(sessions.map((s) => s.id).filter(Boolean));
  const commits = progress.commits ?? {};
  return {
    now, today, fmt, sessions, lanes, calm, asks, testItem,
    allAsks: testItem ? [...asks, testItem] : asks,
    running: sessions.filter((s) => s.status === "running" || s.status === "background"),
    merged, mergedN: cap(merged, mergedSrc), closedN: cap(closed, closedSrc),
    inProgress,
    taskInfo: new Map(inProgress.map((t) => [t.id, t])),
    orphans: inProgress.filter((t) => !linked.has(t.id) && !t.children),
    awaitingMerge: doneIssues.filter((row) => !row.merged).length,
    dirtyTotal: progress.dirty?.total ?? 0,
    unpushed: commits.unpushed ?? [],
    ahead: commits.ahead ?? 0,
    behind: commits.behind ?? 0,
    openPrs: openPrs.map((p) => ({ ...p, failed: prFailed(p) })),
  };
}

export function dirtyTag(model, s) {
  const t = s.id && model.taskInfo.get(s.id);
  return t && t.dirty ? `${t.dirty} 个文件没提交` : "";
}
