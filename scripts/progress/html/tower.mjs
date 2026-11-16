import { byStatus, dirtyTag, esc } from "./model.mjs";

const BOARD = { running: "在跑 RUN", background: "后台 TAXI", waiting: "等你 HOLD", done: "做完 LANDED", idle: "闲着 PARKED" };
const UNPUSHED_SHOWN = 5;

function flap(text, plain) {
  return `<span class="b-flap${plain ? " lead" : ""}">${[...String(text).padEnd(4, " ")].map((c) => `<i>${c === " " ? "&nbsp;" : esc(c)}</i>`).join("")}</span>`;
}

function subline(m, s, lane) {
  if (s.ask || s.note) return s.ask || s.note;
  const dirty = dirtyTag(m, s);
  if (dirty) return dirty;
  if (s.kind === "lead") {
    const group = lane.groups.find((g) => g.lead === s);
    return `组长 · 派出 ${group ? group.tasks.length : 0} 个任务会话`;
  }
  return s.kind === "controller" ? "总控" : s.name;
}

function gate(s, lane) {
  if (s.kind === "lead") return "组长";
  if (s.kind === "controller") return "总控";
  const group = lane.groups.find((g) => g.tasks.includes(s));
  return group?.lead?.short ?? "直接派出";
}

function row(m, s, lane) {
  const code = s.id ?? (s.kind === "lead" ? "LEAD" : s.kind === "controller" ? "CTRL" : "SESS");
  return `<div class="b-row">${flap(code, !s.id)}<div class="what"><b>${esc(s.short)}</b><p>${esc(subline(m, s, lane))}</p></div><span class="gate">${esc(gate(s, lane))}</span><span class="b-st s-${s.status}"><span class="lamp"></span>${esc(BOARD[s.status])}</span></div>`;
}

function lanes(m) {
  return m.lanes.map((lane) => {
    const own = lane.own ? [lane.own] : [];
    const rows = [...own, ...lane.members].sort(byStatus);
    return `<div class="b-lane"><div class="b-lane-h"><b>${esc(lane.ctl.short)}</b><span>${lane.size ? `${lane.size} SESSIONS` : "LONG-RUN"}</span></div><div class="b-rows">${rows.map((s) => row(m, s, lane)).join("")}</div></div>`;
  }).join("");
}

function runway(m) {
  const first = m.merged.length ? m.merged[m.merged.length - 1].mergedAt : m.now;
  const h0 = Math.max(0, Math.floor(m.fmt.hours(first)) - 1);
  const h1 = Math.max(h0 + 2, Math.min(24, Math.floor(m.fmt.hours(m.now)) + 1));
  const span = h1 - h0;
  const pos = (d) => (((m.fmt.hours(d) - h0) / span) * 100).toFixed(2);
  const step = span > 12 ? 2 : 1;
  const hours = [];
  for (let h = h0; h <= h1; h += step) hours.push(`<span class="hr" style="left:${(((h - h0) / span) * 100).toFixed(2)}%">${String(h).padStart(2, "0")}</span>`);
  const ticks = m.merged.map((p) => `<span class="tick" title="#${esc(p.number)} ${esc(p.title)}" style="left:${pos(p.mergedAt)}%;height:${30 + ((Number(p.number) * 37) % 70)}%"></span>`).join("");
  return `<div class="b-runway">${hours.join("")}${ticks}<span class="now" style="left:${pos(m.now)}%"></span></div>`;
}

function apron(m) {
  const prs = m.openPrs.map((p) => `<div class="r"><code>#${esc(p.number)}</code><span>${esc(p.title)}</span><em class="${p.failed ? "bad" : ""}">${p.failed ? "FAIL" : "QUEUED"}</em></div>`).join("");
  const orphans = m.orphans.map((t) => `<div class="r"><code>${esc(t.id)}</code><span>${esc(t.title)}</span><em>${t.stale ? "STALE" : t.owner ? "ELSEWHERE" : "NOBODY"}</em></div>`).join("");
  const commits = m.unpushed.slice(-UNPUSHED_SHOWN).reverse().map((c) => `<div class="r"><span>${esc(c.subject)}</span></div>`).join("");
  return `<div class="b-misc"><div><h3>OPEN PR</h3>${prs || "—"}</div><div><h3>NO SESSION</h3>${orphans || "—"}</div><div><h3>UNPUSHED · 最近 ${UNPUSHED_SHOWN} 个</h3>${commits || "—"}</div></div>`;
}

export function renderTower(m) {
  const holds = m.allAsks.map((a, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><div><b><span class="k">${esc(a.kind)}</span>${esc(a.title)}</b><p>${esc(a.detail)}${a.from ? ` · ${esc(a.from)}` : ""}</p></div></li>`).join("");
  const log = m.merged.map((p) => `<li><time>${esc(m.fmt.hm(p.mergedAt))}</time><code>#${esc(p.number)}</code><span>${esc(p.title)}</span></li>`).join("");
  return `<div class="b-in">
<header class="b-top"><div class="b-brand"><small>FUYU · CONTROL TOWER</small>塔台</div><div class="b-clock"><b>${esc(m.fmt.hm(m.now))}</b><span>${esc(m.today)} ${esc(m.fmt.weekday(m.now))}</span></div></header>
<section class="b-hold"><div><div class="b-hold-n">${String(m.asks.length).padStart(2, "0")}</div><div class="b-hold-l">等你处理 · HOLD</div></div>${holds ? `<ol>${holds}</ol>` : "<ol><li><span>—</span><div><b>没有事在等你</b></div></li></ol>"}</section>
<section class="b-metrics">
<div class="b-metric run"><div class="code">RUN</div><div class="n">${m.running.length}</div><div class="l">在跑的会话</div></div>
<div class="b-metric land"><div class="code">LANDED</div><div class="n">${esc(m.mergedN)}</div><div class="l">今天合入的 PR</div></div>
<div class="b-metric"><div class="code">ACTIVE</div><div class="n">${m.inProgress.length}</div><div class="l">进行中的任务</div></div>
<div class="b-metric"><div class="code">DIRTY</div><div class="n">${m.dirtyTotal}</div><div class="l">没提交的文件</div></div>
</section>
<div class="b-foot"><span>UNPUSHED ${m.unpushed.length}</span><span>AHEAD ${m.ahead}</span><span>BEHIND ${m.behind}</span><span>OPEN PR ${m.openPrs.length}</span><span>DONE, NOT MERGED ${m.awaitingMerge}</span><span>ISSUES CLOSED TODAY ${esc(m.closedN)}</span></div>
<section class="b-sec"><h2>航班 <small>按总控分泳道，组长和任务会话按状态排</small></h2>${lanes(m)}${m.calm.length ? `<div class="b-foot">安静：${esc(m.calm.join(" / "))}</div>` : ""}</section>
<section class="b-sec"><h2>跑道 <small>今天每一次合入</small></h2>${runway(m)}${log ? `<ol class="b-log">${log}</ol>` : ""}</section>
<section class="b-sec"><h2>停机坪</h2>${apron(m)}</section>
</div>`;
}
