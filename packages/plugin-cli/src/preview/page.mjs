import { escapeHtml, markdownHtml } from "./markdown.mjs";

export const CARD_WIDTH = 403;
export const DIALOG_WIDTH = 860;
const STRIP_RATIO = 3.4;

const TEXT = {
  "zh-CN": {
    language: "中文",
    install: "安装",
    network: "联网",
    noNetwork: "不联网",
    shotCount: (count) => `共 ${count} 张`,
    officialTitle: "浮屿团队发布",
    official: "浮屿团队",
    tabs: ["说明", "更新日志", "版本"],
    info: { version: "版本", requires: "需要", platforms: "平台", license: "协议" },
    requiresFuyu: (range) => `浮屿 ${range}`,
    links: { repository: "源码仓库", homepage: "主页", bugs: "反馈问题", funding: "赞助" },
    noReadme: "作者没有写说明。",
    close: "关闭",
    categories: { productivity: "效率", utilities: "工具", todos: "待办", information: "资讯", developer: "开发", media: "媒体", ai: "AI", appearance: "外观", communication: "沟通" },
  },
  en: {
    language: "English",
    install: "Install",
    network: "Network",
    noNetwork: "Offline",
    shotCount: (count) => `${count} screenshots`,
    officialTitle: "Published by the Fuyu team",
    official: "Fuyu team",
    tabs: ["Overview", "Changelog", "Versions"],
    info: { version: "Version", requires: "Requires", platforms: "Platforms", license: "License" },
    requiresFuyu: (range) => `Fuyu ${range}`,
    links: { repository: "Source", homepage: "Homepage", bugs: "Report an issue", funding: "Sponsor" },
    noReadme: "The author didn't write a description.",
    close: "Close",
    categories: { productivity: "Productivity", utilities: "Utilities", todos: "To-dos", information: "News & info", developer: "Developer", media: "Media", ai: "AI", appearance: "Look", communication: "Communication" },
  },
};
const PLATFORMS = { windows: "Windows", macos: "macOS", linux: "Linux" };
const THEME_NAMES = { dark: "Dark", light: "Light" };

const OWN_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html { background: #0c0d0f; }
body { margin: 0; font-family: var(--font-ui); font-size: 13px; -webkit-font-smoothing: antialiased; }
button { font: inherit; }
.fp-note { margin: 0; padding: 16px 24px; color: rgba(248, 246, 240, 0.72); font-size: 12.5px; line-height: 1.6; }
.fp-note h1 { margin: 0 0 4px; color: #f8f6f0; font-size: 15px; }
.fp-note ul { margin: 6px 0 0; padding-left: 18px; }
.fp-note code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 11.5px; }
.fp-stage.settings-stage { height: auto; display: grid; justify-items: start; gap: 16px; padding: 20px 24px 28px; }
.fp-label { margin: 0; color: var(--text-3); font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
.fp-card { width: ${CARD_WIDTH}px; max-width: 100%; }
.fp-stage .plugin-dialog { width: min(${DIALOG_WIDTH}px, 100%); max-height: none; }
.fp-stage .market-card__name, .fp-stage .plugin-btn, .fp-stage .plugin-icon-btn, .fp-stage .plugin-tabs__tab, .fp-stage .market-shot__open, .fp-stage .market-card { cursor: default; }
`;

function svg(body, size, width) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const CHECK = '<path d="M20 6 9 17l-5-5"/>';
const CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
const LINK = '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';

export function localized(value, locale, fallback = "") {
  if (!value) return fallback;
  if (typeof value === "string") return value || fallback;
  return (locale === "en" ? value.en : value["zh-CN"]) || value["zh-CN"] || value.en || fallback;
}

function initial(title) {
  return escapeHtml((Array.from(title.replace(/^@[^/]+\//, "").trim())[0] ?? "?").toUpperCase());
}

function logo(model, title, size) {
  const sized = size ? ` plugin-icon--${size}` : "";
  if (!model.icon) return `<span class="plugin-icon${sized}" aria-hidden="true">${initial(title)}</span>`;
  return `<span class="plugin-icon${sized} plugin-icon--img" aria-hidden="true"><img class="plugin-icon__img" src="${model.icon}" alt=""></span>`;
}

function official(text) {
  return `<span class="plugin-verified" title="${escapeHtml(text.officialTitle)}" role="img" aria-label="${escapeHtml(text.officialTitle)}">${svg(CHECK, 10, 3.2)}</span>`;
}

function categoryName(model, text) {
  const id = model.categories[0];
  return id ? (text.categories[id] ?? id) : null;
}

function cover(model, title, text) {
  const tint = model.tint ? ` style="--market-tint: ${model.tint}"` : "";
  const shots = model.screenshots;
  if (shots.length === 0) return `<div class="market-cover" data-market-cover="0"${tint}>${logo(model, title, "lg")}</div>`;
  const strip = `if (this.naturalWidth / this.naturalHeight > ${STRIP_RATIO}) this.classList.add('market-cover__shot--strip')`;
  const count = shots.length > 1 ? `<span class="market-cover__count">${escapeHtml(text.shotCount(shots.length))}</span>` : "";
  return `<div class="market-cover" data-market-cover="${shots.length}"${tint}><img class="market-cover__shot" src="${shots[0].src}" alt="" onload="${strip}">${count}</div>`;
}

function card(model, locale) {
  const text = TEXT[locale];
  const title = localized(model.displayName, locale, model.name);
  const description = localized(model.description, locale);
  const sub = [model.official ? null : model.publisher, categoryName(model, text), model.version ? `v${model.version}` : null].filter(Boolean).join(" · ");
  return `<article class="market-card" data-preview="card">
${cover(model, title, text)}
<div class="market-card__main">
<div class="market-card__head">
${logo(model, title)}
<div class="market-card__title">
<div class="market-card__line"><button class="market-card__name" type="button" title="${escapeHtml(title)}">${escapeHtml(title)}</button>${model.official ? official(text) : ""}</div>
${sub ? `<span class="market-card__sub">${escapeHtml(sub)}</span>` : ""}
</div>
</div>
${description ? `<p class="market-card__desc">${escapeHtml(description)}</p>` : ""}
</div>
<div class="market-card__foot">
<span class="market-card__facts">${escapeHtml(model.network ? text.network : text.noNetwork)}</span>
<span class="market-card__action"><button class="plugin-btn plugin-btn--sm plugin-btn--primary" type="button">${escapeHtml(text.install)}</button></span>
</div>
</article>`;
}

function detail(model, locale) {
  const text = TEXT[locale];
  const title = localized(model.displayName, locale, model.name);
  const publisher = model.official ? text.official : model.author || model.publisher;
  const sub = [publisher, categoryName(model, text)].filter(Boolean).join(" · ");
  const shots = model.screenshots
    .map((shot) => {
      const caption = localized(shot.caption, locale);
      return `<figure class="market-shot"><button class="market-shot__open" type="button"><img src="${shot.src}" alt="${escapeHtml(caption || title)}"></button>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    })
    .join("");
  const readme = (model.readme[locale] ?? "").trim() || localized(model.description, locale);
  const info = [
    [text.info.version, model.version ? `v${model.version}` : null],
    [text.info.requires, model.engines ? text.requiresFuyu(model.engines) : null],
    [text.info.platforms, model.platforms.map((item) => PLATFORMS[item] ?? item).join(" · ") || null],
    [text.info.license, model.license],
  ].filter(([, value]) => value);
  const links = Object.keys(text.links).filter((key) => model.links[key]);
  return `<div class="plugin-dialog market-dialog market-dialog--wide" role="group" aria-label="${escapeHtml(title)}" data-preview="detail">
<div class="plugin-dialog__head">
${logo(model, title, "lg")}
<div class="plugin-dialog__heading">
<div class="market-card__line"><span class="plugin-dialog__title">${escapeHtml(title)}</span>${model.official ? official(text) : ""}</div>
<span class="plugin-dialog__sub" title="${escapeHtml(model.name)}">${escapeHtml(sub)}</span>
</div>
<div class="plugin-dialog__head-actions">
<span class="market-card__action"><button class="plugin-btn plugin-btn--sm plugin-btn--primary" type="button">${escapeHtml(text.install)}</button></span>
<button class="plugin-icon-btn" type="button" aria-label="${escapeHtml(text.close)}">${svg(CLOSE, 15, 2.2)}</button>
</div>
</div>
<div class="plugin-dialog__body">
${shots ? `<div class="market-shots" role="group">${shots}</div>` : ""}
<div class="market-detail">
<div class="market-detail__main">
<div class="plugin-tabs market-detail__tabs" role="tablist">${text.tabs.map((tab, index) => `<button class="plugin-tabs__tab" type="button" role="tab" aria-selected="${index === 0}">${escapeHtml(tab)}</button>`).join("")}</div>
<div class="market-detail__panel" role="tabpanel">${readme ? `<div class="markdown market-markdown">${markdownHtml(readme)}</div>` : `<p class="plugin-callout">${escapeHtml(text.noReadme)}</p>`}</div>
</div>
<aside class="market-detail__aside">
<dl>${info.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
${links.length > 0 ? `<div class="market-detail__links">${links.map((key) => `<button class="plugin-btn plugin-btn--ghost plugin-btn--sm" type="button" title="${escapeHtml(model.links[key])}">${svg(LINK, 12, 2.2)}${escapeHtml(text.links[key])}</button>`).join("")}</div>` : ""}
</aside>
</div>
</div>
</div>`;
}

function stage(model, theme, locale) {
  const classes = theme === "light" ? "fp-stage settings-stage settings-stage--light island-light" : "fp-stage settings-stage";
  return `<section class="${classes}" lang="${locale}" data-theme="${theme}" data-locale="${locale}">
<h2 class="fp-label">${THEME_NAMES[theme]} · ${TEXT[locale].language}</h2>
<div class="fp-card">${card(model, locale)}</div>
${detail(model, locale)}
</section>`;
}

export function previewPage({ model, css, themes, locales, notes = [] }) {
  const title = localized(model.displayName, "en", model.name);
  const stages = locales.flatMap((locale) => themes.map((theme) => stage(model, theme, locale)));
  const list = notes.length > 0 ? `<ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}: market preview</title>
<style>
${css}
${OWN_CSS}</style>
</head>
<body>
<header class="fp-note">
<h1>${escapeHtml(title)}: how it will look on the Fuyu market</h1>
A local approximation drawn by <code>fuyu-plugin preview</code> with the market's own styles: the card at its width in the default settings window (${CARD_WIDTH}px) and the detail page. The real detail page is at most 760px high and scrolls; here it is shown in full. Size, update date, likes, the permissions list, the changelog and the versions tab come from the market and are not shown.
${list}
</header>
${stages.join("\n")}
</body>
</html>
`;
}
