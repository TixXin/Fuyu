export const PAGE_SLOT = "island.page/v1";
export const BAR_SLOT = "island.collapsed/v1";
export const PAGE_SIZE = Object.freeze({ width: 792, height: 360 });

export const PRELUDE_JS = `
import sample from "fuyu-shots:sample";

const params = new URLSearchParams(location.hash.slice(1));
const number = (name) => (params.has(name) ? Number(params.get(name)) : null);
export const shot = {
  list: params.has("list"),
  slot: params.get("slot"),
  id: params.get("id"),
  locale: params.get("locale") || "zh-CN",
  theme: params.get("theme") === "light" ? "light" : "dark",
  width: number("width"),
  height: number("height"),
};
Object.defineProperty(navigator, "language", { configurable: true, get: () => shot.locale });
Object.defineProperty(navigator, "languages", { configurable: true, get: () => [shot.locale] });
document.documentElement.lang = shot.locale;
document.documentElement.dataset.theme = shot.theme;
if (sample && sample.now !== undefined && sample.now !== null) {
  const RealDate = Date;
  const fixed = new RealDate(sample.now).getTime();
  if (Number.isNaN(fixed)) throw new Error("sample.now is not a date: " + String(sample.now));
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  };
}
export { sample };
`;

export const MAIN_JS = `
import { sample, shot } from "fuyu-shots:prelude";
import { Component, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import plugin from "fuyu-shots:client";

const PAGE_SLOT = ${JSON.stringify(PAGE_SLOT)};
const registered = [];
const listeners = new Set();
const unanswered = new Set();
const data = sample && typeof sample === "object" ? sample : {};
const report = (value) => {
  window.__fuyuShots = { ...value, unanswered: [...unanswered].sort() };
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const ctx = {
  slots: {
    add(name, item) {
      registered.push({ name, item });
      return async () => {};
    },
  },
  host: {
    call(method, params) {
      const calls = data.host?.calls ?? {};
      if (!Object.hasOwn(calls, method)) {
        unanswered.add(method);
        return Promise.reject(new Error('no sample answer for the host call "' + method + '"'));
      }
      const answer = calls[method];
      return new Promise((resolve) => resolve(typeof answer === "function" ? answer(params) : answer));
    },
    on(topic, listener) {
      const entry = { topic, listener };
      listeners.add(entry);
      return async () => {
        listeners.delete(entry);
      };
    },
  },
  effect(run) {
    const dispose = run();
    return async () => {
      if (typeof dispose === "function") dispose();
    };
  },
  settings: { open: async () => {} },
  island: { open: async () => {}, collapse: async () => false },
};

function localized(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value[shot.locale] ?? value.en ?? value["zh-CN"] ?? "";
  return "";
}

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Page({ item }) {
  const title = localized(item.title);
  const icon = item.icon ? h(Boundary, { onError: () => {} }, h(item.icon, { size: 15, strokeWidth: 1.8 })) : title.slice(0, 1);
  const style = { width: shot.width ?? ${PAGE_SIZE.width}, height: shot.height ?? ${PAGE_SIZE.height} };
  return h(
    "section",
    { className: "fuyu-shot fuyu-shot--page", style },
    h("header", { className: "fuyu-shot__header" }, h("span", { className: "fuyu-shot__dot", title }, icon)),
    h("div", { className: "fuyu-shot__content" }, h("div", { className: "plugin-slot", "data-slot": PAGE_SLOT }, h(item.component))),
  );
}

function Bar({ item }) {
  return h(
    "section",
    { className: "fuyu-shot fuyu-shot--bar" },
    h("span", { className: "fuyu-shot__fit" }, h("div", { className: "plugin-slot", "data-slot": shot.slot }, h(item.component))),
  );
}

async function settle(root) {
  const started = performance.now();
  let last = root.innerHTML;
  let since = started;
  for (;;) {
    await sleep(50);
    const now = performance.now();
    const html = root.innerHTML;
    if (html !== last) {
      last = html;
      since = now;
    } else if (now - since >= 300) return true;
    if (now - started > 8000) return false;
  }
}

async function main() {
  const apply = typeof plugin === "function" ? plugin : plugin?.apply;
  if (typeof apply !== "function") return report({ state: "failed", error: "the island entry does not export a plugin (a function, or an object with apply)" });
  await apply.call(plugin, ctx);
  const items = registered.map(({ name, item }) => ({ slot: name, id: item.id, title: localized(item.title) }));
  if (shot.list) return report({ state: "listed", items, shots: Array.isArray(data.shots) ? data.shots : null });
  const entry = registered.find(({ name, item }) => name === shot.slot && (!shot.id || item.id === shot.id));
  if (!entry) return report({ state: "failed", error: "the plugin registered nothing in " + shot.slot + (shot.id ? ' with the id "' + shot.id + '"' : "") });
  const stage = document.getElementById("stage");
  if (shot.theme === "light") stage.classList.add("island-light");
  let failure = null;
  const onError = (error) => {
    failure = String(error?.message ?? error);
  };
  createRoot(stage).render(h(Boundary, { onError }, entry.name === PAGE_SLOT ? h(Page, { item: entry.item }) : h(Bar, { item: entry.item })));
  await settle(stage);
  for (const event of Array.isArray(data.host?.events) ? data.host.events : []) {
    for (const listener of [...listeners]) if (listener.topic === event.topic) listener.listener(event.data);
  }
  await document.fonts.ready;
  const settled = await settle(stage);
  if (failure) return report({ state: "failed", error: "the component failed to render: " + failure });
  const shell = stage.querySelector(".fuyu-shot");
  const slot = stage.querySelector(".plugin-slot");
  const box = shell.getBoundingClientRect();
  report({ state: "ready", settled, empty: !slot || slot.childNodes.length === 0, rect: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

main().catch((error) => report({ state: "failed", error: String(error?.message ?? error) }));
`;

export const SHELL_CSS = `
:root {
  color-scheme: dark;
  --font-ui: "Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  --radius-md: 8px;
  --text-1: rgba(248, 246, 240, 0.96);
  --text-2: rgba(248, 246, 240, 0.68);
  --text-3: rgba(248, 246, 240, 0.54);
  --color-text: #f8f6f0;
  --color-white-a06: rgba(255, 255, 255, 0.06);
  --color-white-a08: rgba(255, 255, 255, 0.08);
  --color-white-a10: rgba(255, 255, 255, 0.1);
  --color-white-a12: rgba(255, 255, 255, 0.12);
  --color-accent: #74d6ff;
  --color-on-accent: #06202c;
  --color-warning: #ffd166;
  --usage-danger: #ff7a7a;
  --island-fill: #030303;
  font-family: var(--font-ui);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
:root[data-theme="light"] {
  color-scheme: light;
  --text-1: rgba(24, 24, 30, 0.94);
  --text-2: rgba(24, 24, 30, 0.7);
  --text-3: rgba(24, 24, 30, 0.56);
  --color-text: #18181e;
  --color-white-a06: rgba(0, 0, 0, 0.05);
  --color-white-a08: rgba(0, 0, 0, 0.06);
  --color-white-a10: rgba(0, 0, 0, 0.08);
  --color-white-a12: rgba(0, 0, 0, 0.09);
  --color-accent: #0a7fd1;
  --color-on-accent: #ffffff;
  --color-warning: #b7791f;
  --warning-text: #9a6700;
  --usage-danger: #c42b2b;
  --island-fill: #f2f2f5;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: transparent; }
body { user-select: none; }
button, input, textarea, select { font: inherit; }
#stage { display: inline-block; padding: 8px; vertical-align: top; }
.fuyu-shot { color: var(--color-text); background: var(--island-fill); }
.fuyu-shot--page { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px; overflow: hidden; border-radius: 32px; box-shadow: inset 0 0 0 1px var(--color-white-a08); }
.fuyu-shot__header { flex: none; min-height: 34px; display: flex; align-items: center; gap: 8px; }
.fuyu-shot__dot { width: 26px; height: 26px; display: grid; place-items: center; color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 20%, transparent); border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1; }
.fuyu-shot__content { flex: 1; min-height: 0; contain: layout style; }
.fuyu-shot--bar { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 18px; border-radius: 23.5px; white-space: nowrap; }
.fuyu-shot__fit { display: inline-flex; flex: none; align-items: center; width: max-content; }
.plugin-slot {
  display: contents;
  color-scheme: dark;
  --fuyu-plugin-text: var(--text-1);
  --fuyu-plugin-text-secondary: var(--text-2);
  --fuyu-plugin-text-muted: var(--text-3);
  --fuyu-plugin-surface: var(--color-white-a06);
  --fuyu-plugin-surface-hover: var(--color-white-a10);
  --fuyu-plugin-border: var(--color-white-a12);
  --fuyu-plugin-accent: var(--color-accent);
  --fuyu-plugin-on-accent: var(--color-on-accent);
  --fuyu-plugin-warning: var(--color-warning);
  --fuyu-plugin-danger: var(--usage-danger);
  --fuyu-plugin-font: var(--font-ui);
  --fuyu-plugin-radius: var(--radius-md);
}
.island-light .plugin-slot { color-scheme: light; --fuyu-plugin-warning: var(--warning-text); }
*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }
`;

const escapeScript = (text) => text.replace(/<\/(script)/gi, "<\\/$1");
const escapeStyle = (text) => text.replace(/<\/(style)/gi, "<\\/$1");

export function shotPage({ js, css, plugin }) {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>${escapeStyle(SHELL_CSS)}</style>`,
    `<style data-fuyu-plugin=${JSON.stringify(plugin)}>${escapeStyle(css)}</style>`,
    '</head><body><div id="stage" class="stage"></div>',
    `<script>${escapeScript(js)}</script>`,
    "</body></html>\n",
  ].join("");
}

export function coverPage({ image, width, height, color, theme, strip }) {
  const base = theme === "light" ? "#ffffff" : "#141418";
  const share = theme === "light" ? 14 : 22;
  const room = strip ? 0.6 : 0.84;
  const shadow = `drop-shadow(0 ${Math.round(width * 0.012)}px ${Math.round(width * 0.03)}px rgba(0,0,0,${theme === "light" ? 0.18 : 0.36}))`;
  return [
    '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}',
    `#cover{width:${width}px;height:${height}px;display:grid;place-items:center;overflow:hidden;background:color-mix(in srgb, ${color} ${share}%, ${base});}`,
    `#cover img{display:block;max-width:${Math.round(width * room)}px;max-height:${Math.round(height * 0.8)}px;filter:${shadow};}`,
    `</style></head><body><div id="cover"><img alt="" src="data:image/png;base64,${image.toString("base64")}"></div></body></html>\n`,
  ].join("");
}
