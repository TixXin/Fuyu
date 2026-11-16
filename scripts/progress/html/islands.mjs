import { STATUS_LABEL, dirtyTag, esc } from "./model.mjs";

const ROUTE_LIMIT = 14;

function askRow(a) {
  const from = a.from ? ` <span class="from">· ${esc(a.from)}</span>` : "";
  return `<li><span class="k ${a.cls}">${esc(a.kind)}</span><div><b>${esc(a.title)}</b><p>${esc(a.detail)}${from}</p></div></li>`;
}

function taskChip(m, s, short = s.short) {
  const extra = s.ask || s.note;
  return `<li class="a-task s-${s.status}" title="${esc(STATUS_LABEL[s.status])}"><span class="lamp"></span><code>${esc(s.id ?? "")}</code><span class="t">${esc(short)}</span><span class="x">${esc(dirtyTag(m, s) || STATUS_LABEL[s.status])}</span>${extra ? `<span class="note">${esc(extra)}</span>` : ""}</li>`;
}

function isle(m, lane) {
  const { ctl, groups, status, size } = lane;
  const own = lane.own ? `<div class="a-lead"><ul class="a-tasks">${taskChip(m, ctl, "总控本人")}</ul></div>` : "";
  const body = groups.map(({ lead, tasks }) => {
    const head = lead
      ? `<div class="a-lead-h"><span class="lamp ${lead.status}"></span><span>${esc(lead.short)}</span></div>${lead.ask ? `<p class="a-lead-ask">${esc(lead.ask)}</p>` : ""}`
      : `<div class="a-lead-h"><span>直接派出</span></div>`;
    return `<div class="a-lead">${head}${tasks.length ? `<ul class="a-tasks">${tasks.map((t) => taskChip(m, t)).join("")}</ul>` : ""}</div>`;
  }).join("");
  return `<article class="a-isle s-${status}"><header><span class="lamp ${status}"></span><h3>${esc(ctl.short)}</h3><span class="cnt">${size ? `${size} 个会话` : "总控"}</span></header>${own}${body}</article>`;
}

function port(m) {
  const prs = m.openPrs.map((p) => `<div class="row"><code>#${esc(p.number)}</code><span>${esc(p.title)}</span><em class="tag ${p.failed ? "bad" : "ok"}">${p.failed ? "检查没过" : esc((p.state ?? []).at(-1) ?? "开着")}</em></div>`).join("");
  const orphans = m.orphans.map((t) => `<div class="row"><code>${esc(t.id)}</code><span>${esc(t.title)}</span><em class="tag">${esc(t.stale ? "很久没动" : t.owner ? t.host || t.owner : "没人负责")}</em></div>`).join("");
  return `<div class="a-panel a-port"><dl><div><dt>开着的 PR</dt><dd>${prs || "<span>没有</span>"}</dd></div><div><dt>没有会话在做的进行中任务</dt><dd>${orphans || "<span>没有</span>"}</dd></div></dl></div>`;
}

export function renderIslands(m) {
  const wait = m.asks.length;
  const route = m.merged.slice(0, ROUTE_LIMIT).map((p) => `<li><time>${esc(m.fmt.hm(p.mergedAt))}</time><i></i><span class="t"><code>#${esc(p.number)}</code>${esc(p.title)}</span></li>`).join("");
  const more = m.merged.length > ROUTE_LIMIT ? `<li class="more">还有 ${m.merged.length - ROUTE_LIMIT} 个更早的</li>` : "";
  return `<div class="a-in">
<header class="a-hero"><div class="a-island${wait ? " hold" : ""}"><div class="a-bar">${wait ? `<span class="a-hold-n">${wait}</span><b>件事在等你</b>` : `<span class="lamp done"></span><b>没有事在等你</b>`}<span class="meta">${esc(m.fmt.hm(m.now))} · ${esc(m.fmt.weekday(m.now))}</span></div>${m.allAsks.length ? `<ol class="a-asks">${m.allAsks.map(askRow).join("")}</ol>` : ""}</div></header>
<div class="a-buoys">
<div class="a-buoy"><div class="n"><span class="lamp running"></span>${m.running.length}</div><div class="l">在跑的会话</div></div>
<div class="a-buoy wait"><div class="n">${wait}</div><div class="l">等你处理</div></div>
<div class="a-buoy"><div class="n">${esc(m.mergedN)}</div><div class="l">今天合入的 PR</div></div>
<div class="a-buoy"><div class="n">${m.inProgress.length}</div><div class="l">进行中的任务</div></div>
</div>
<p class="a-sub"><span>${m.dirtyTotal} 个文件没提交</span><span>${m.unpushed.length} 个提交没推</span><span>${m.openPrs.length} 个 PR 开着</span><span>${m.awaitingMerge} 个任务做完等合入</span><span>今天关了 ${esc(m.closedN)} 个 issue</span></p>
<h2 class="a-h">群岛 <small>每座岛是一个总控，岛上是组长和它派出的任务会话</small></h2>
<div class="a-isles">${m.lanes.map((l) => isle(m, l)).join("")}</div>
${m.calm.length ? `<p class="a-calm">风平浪静：${esc(m.calm.join(" · "))}</p>` : ""}
<div class="a-lower">
<section><h2 class="a-h">今日航线 <small>合入 main 的 PR</small></h2><div class="a-panel">${route ? `<ol class="a-route">${route}${more}</ol>` : "<p class=\"a-calm\">今天还没有合入</p>"}</div></section>
<section><h2 class="a-h">港口 <small>PR 和没人管的任务</small></h2>${port(m)}</section>
</div></div>`;
}
