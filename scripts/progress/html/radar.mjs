import { STATUS_LABEL, esc } from "./model.mjs";

const RING = { waiting: 140, running: 245, background: 245, done: 365, idle: 365 };
const OUTER = 430;
const LAST_SHOWN = 5;

const f = (n) => n.toFixed(1);
const point = (r, a) => [Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r];

function frame(lanes, width) {
  let svg = "";
  lanes.forEach((_, i) => {
    if (i % 2 === 0 && lanes.length > 1) {
      const [x1, y1] = point(OUTER, i * width);
      const [x2, y2] = point(OUTER, (i + 1) * width);
      svg += `<path class="sector" d="M0 0 L${f(x1)} ${f(y1)} A${OUTER} ${OUTER} 0 0 1 ${f(x2)} ${f(y2)} Z"/>`;
    }
    const [sx, sy] = point(OUTER, i * width);
    svg += `<line class="spoke" x1="0" y1="0" x2="${f(sx)}" y2="${f(sy)}"/>`;
  });
  svg += [140, 245, 365, OUTER].map((r, i) => `<circle class="ring${i === 0 ? " inner" : ""}" r="${r}"/>`).join("");
  return svg;
}

function dots(lanes, width, numberOf) {
  let svg = "";
  const placed = [];
  lanes.forEach((lane, i) => {
    const members = lane.own ? [lane.own, ...lane.members] : lane.members;
    const rings = new Map();
    for (const s of members) {
      const r = RING[s.status];
      if (!rings.has(r)) rings.set(r, []);
      rings.get(r).push(s);
    }
    for (const [r, list] of rings) {
      list.forEach((s, k) => {
        const a = i * width + ((k + 1) / (list.length + 1)) * width;
        const [x, y] = point(r + (list.length > 2 || (r === RING.waiting && list.length > 1) ? (k % 2 ? 24 : -24) : 0), a);
        placed.push({ s, x, y });
      });
    }
    const [lx, ly] = point(OUTER + 38, i * width + width / 2);
    const anchor = Math.abs(lx) < 40 ? "middle" : lx > 0 ? "start" : "end";
    svg += `<text class="sec-l" x="${f(lx)}" y="${f(ly + 6)}" text-anchor="${anchor}">${esc(lane.ctl.short)}</text>`;
    svg += `<text class="sec-n" x="${f(lx)}" y="${f(ly + 26)}" text-anchor="${anchor}">${lane.size ? `${lane.size} 个会话` : "总控"}</text>`;
  });
  for (const { s, x, y } of placed) {
    const small = s.kind !== "task";
    const tip = `<title>${esc(`${s.title} · ${STATUS_LABEL[s.status]}`)}</title>`;
    const n = numberOf.get(s.key);
    if (n) {
      svg += `<circle class="c-halo" cx="${f(x)}" cy="${f(y)}" r="28"/><circle class="dot waiting" cx="${f(x)}" cy="${f(y)}" r="16">${tip}</circle><text class="num-t" x="${f(x)}" y="${f(y + 6)}" text-anchor="middle">${n}</text>`;
      continue;
    }
    svg += `<circle class="dot ${s.status}${small ? " lead" : ""}" cx="${f(x)}" cy="${f(y)}" r="${small ? 7 : 11}">${tip}</circle>`;
    if (small) continue;
    const right = x >= 0;
    svg += `<text class="lbl${small ? " lead" : ""}" x="${f(x + (right ? 15 : -15))}" y="${f(y + 5)}" text-anchor="${right ? "start" : "end"}">${esc(s.id ?? s.short)}</text>`;
  }
  return svg;
}

function hourBars(m) {
  const last = Math.floor(m.fmt.hours(m.now));
  const counts = Array.from({ length: last + 1 }, () => 0);
  for (const p of m.merged) {
    const h = Math.floor(m.fmt.hours(p.mergedAt));
    if (h <= last) counts[h] += 1;
  }
  const max = Math.max(1, ...counts);
  const bars = counts.map((v, h) => `<i class="${v ? "" : "zero"}" style="height:${((v / max) * 100).toFixed(1)}%" title="${h} 点 · ${v} 个"></i>`).join("");
  return `<div class="c-bars">${bars}</div><div class="c-axis"><span>0 点</span><span>${last} 点</span></div>`;
}

export function renderRadar(m) {
  const width = (Math.PI * 2) / Math.max(1, m.lanes.length);
  const wait = m.asks.length;
  const svg = `${frame(m.lanes, width)}${dots(m.lanes, width, new Map(m.asks.map((a, i) => [a.key, i + 1]).filter(([k]) => k)))}<rect class="core" x="-80" y="-46" width="160" height="92" rx="46"/><text class="core-t" x="0" y="10" text-anchor="middle">${wait}</text><text class="core-s" x="0" y="33" text-anchor="middle">等 你</text>`;
  const near = m.allAsks.map((a, i) => `<li>${a.kind === "实测" ? "<span class=\"lamp\"></span>" : `<span class="c-no">${i + 1}</span>`}<div><b>${esc(a.title)}</b><p>${esc(a.detail)}${a.from ? ` · ${esc(a.from)}` : ""}</p></div></li>`).join("");
  const last = m.merged.slice(0, LAST_SHOWN).map((p) => `<li><code>#${esc(p.number)}</code><span>${esc(p.title)}</span></li>`).join("");
  return `<div class="c-in">
<div class="c-stage"><div class="c-head"><h2>雷达</h2><p>扇区是总控，离中心越近越需要你：内圈等你，中圈在跑，外圈闲着或做完。</p></div>
<svg class="c-svg" viewBox="-600 -505 1200 1010" role="img" aria-label="会话雷达">${svg}</svg>
<div class="c-legend"><span><span class="lamp waiting"></span>等你</span><span><span class="lamp running"></span>在跑</span><span><span class="lamp background"></span>后台跑</span><span><span class="lamp done"></span>做完</span><span><span class="lamp"></span>闲着</span><span>数字对应右边「等你处理」的序号；实心大点是任务会话，空心小点是组长（悬停看名字）</span></div>
</div>
<aside class="c-side">
<div class="c-card"><h3>近处 · 等你处理</h3>${near ? `<ul class="c-near">${near}</ul>` : "<p>没有事在等你</p>"}</div>
<div class="c-card"><div class="c-stats"><div><b>${m.running.length}</b><span>在跑</span></div><div><b>${esc(m.mergedN)}</b><span>今天合入</span></div><div><b>${m.inProgress.length}</b><span>进行中任务</span></div></div></div>
<div class="c-card"><h3>今天每小时合入</h3>${hourBars(m)}${last ? `<ul class="c-last">${last}</ul>` : ""}</div>
<div class="c-card"><h3>其他</h3><div class="c-legend"><span>${m.dirtyTotal} 个文件没提交</span><span>${m.unpushed.length} 个提交没推</span><span>${m.openPrs.length} 个 PR 开着</span><span>${m.awaitingMerge} 个任务做完等合入</span>${m.calm.length ? `<span>安静：${esc(m.calm.join("、"))}</span>` : ""}</div></div>
</aside></div>`;
}
