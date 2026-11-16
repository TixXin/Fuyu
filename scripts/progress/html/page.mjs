import { readFileSync } from "node:fs";
import { buildModel, esc } from "./model.mjs";
import { renderIslands } from "./islands.mjs";
import { renderRadar } from "./radar.mjs";
import { renderTower } from "./tower.mjs";

export const VIEWS = [
  { key: "a", label: "群岛", render: renderIslands, cls: "va" },
  { key: "b", label: "塔台", render: renderTower, cls: "vb" },
  { key: "c", label: "雷达", render: renderRadar, cls: "vc" },
];

const CSS_FILES = ["base.css", "islands.css", "tower.css", "radar.css"];

function styles() {
  return CSS_FILES.map((name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8")).join("\n");
}

const CLIENT = `(() => {
  const KEY = "fuyu-progress-report";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch {} };
  const root = document.documentElement;
  const press = (group, attr, value) => document.querySelectorAll(group + " button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
  const show = (v) => {
    if (!document.getElementById("v-" + v)) return;
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.id === "v-" + v));
    press("#views", "v", v);
    history.replaceState(null, "", "#" + v);
    save({ view: v });
  };
  const theme = (t) => {
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    press("#themes", "t", t || "");
    save({ theme: t || "" });
  };
  document.getElementById("views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.v); });
  document.getElementById("themes").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) theme(b.dataset.t); });
  const saved = read();
  if (saved.theme) theme(saved.theme);
  show(location.hash.slice(1) || saved.view || "a");
})();`;

export function renderReport(data) {
  const m = buildModel(data);
  const stamp = `${m.fmt.hm(m.now)} · ${m.today}`;
  const tabs = VIEWS.map((v, i) => `<button data-v="${v.key}" aria-pressed="${i === 0}">${v.label}</button>`).join("");
  const views = VIEWS.map((v, i) => `<section class="view ${v.cls}${i === 0 ? " on" : ""}" id="v-${v.key}">${v.render(m)}</section>`).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>进度报告 ${esc(stamp)}</title>
<style>
${styles()}</style>
</head>
<body>
<nav class="switch">
<h1>进度报告</h1>
<div class="seg" id="views" role="group" aria-label="样式">${tabs}</div>
<span class="grow"></span>
<span class="hint">数据取于 ${esc(stamp)}</span>
<div class="seg" id="themes" role="group" aria-label="深浅色"><button data-t="" aria-pressed="true">跟随系统</button><button data-t="light" aria-pressed="false">浅色</button><button data-t="dark" aria-pressed="false">深色</button></div>
</nav>
${views}
<script>${CLIENT}</script>
</body>
</html>
`;
}
