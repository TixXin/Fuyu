import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readManifest } from "./build.mjs";
import { BuildError } from "./errors.mjs";
import { lintListing } from "./lint.mjs";
import { iconColor } from "./shots.mjs";
import { withBrowser } from "./shots/browser.mjs";
import { previewPage } from "./preview/page.mjs";

export const DEFAULT_PREVIEW_FILE = "build/preview.html";
export const PREVIEW_THEMES = Object.freeze(["dark", "light"]);
export const PREVIEW_LOCALES = Object.freeze(["zh-CN", "en"]);
const OFFICIAL_SCOPE = "@fuyu/";
const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

function dataUri(root, path) {
  const mime = MIME[extname(String(path)).toLowerCase()];
  const file = join(root, String(path));
  if (!mime || !existsSync(file)) return null;
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}

function webUrl(value) {
  const raw = text(isObject(value) ? value.url : value);
  if (!raw) return null;
  const short = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(raw);
  if (short) return `https://github.com/${short[1]}`;
  const url = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  return /^https?:\/\//i.test(url) ? url : null;
}

function readme(root, locale) {
  for (const name of [`README.${locale}.md`, "README.md"]) {
    const file = join(root, name);
    if (existsSync(file)) return readFileSync(file, "utf8");
  }
  return "";
}

export function previewModel(dir, options = {}) {
  const root = resolve(dir);
  const appKey = options.appKey ?? "fuyu";
  const pkg = readManifest(root);
  const app = pkg?.[appKey];
  if (!isObject(app)) throw new BuildError(`package.json has no ${appKey} section`);
  const warnings = [];
  const name = String(pkg.name ?? "");
  const icon = typeof app.icon === "string" ? dataUri(root, app.icon) : null;
  if (typeof app.icon === "string" && !icon) warnings.push({ path: `${appKey}.icon`, code: "preview:icon", message: `cannot show ${app.icon}: the file is missing or is not an svg, png, jpg or webp` });
  const screenshots = [];
  for (const [index, shot] of (Array.isArray(app.screenshots) ? app.screenshots : []).entries()) {
    const src = isObject(shot) && typeof shot.path === "string" ? dataUri(root, shot.path) : null;
    if (src) screenshots.push({ src, caption: shot.caption ?? null });
    else warnings.push({ path: `${appKey}.screenshots[${index}]`, code: "preview:screenshot", message: `cannot show ${isObject(shot) ? shot.path : shot}: the file is missing or is not a png, jpg or webp` });
  }
  const repository = webUrl(pkg.repository);
  const owner = /^https:\/\/github\.com\/([^/]+)\//.exec(`${repository ?? ""}/`)?.[1] ?? /^@([^/]+)\//.exec(name)?.[1] ?? null;
  const model = {
    name,
    version: text(pkg.version),
    official: options.official ?? name.startsWith(OFFICIAL_SCOPE),
    displayName: app.displayName ?? null,
    description: app.description ?? text(pkg.description),
    icon,
    tint: iconColor(root, app),
    screenshots,
    categories: Array.isArray(app.categories) ? app.categories.filter((item) => typeof item === "string") : [],
    network: Array.isArray(app.network) && app.network.length > 0,
    publisher: owner,
    author: text(isObject(pkg.author) ? pkg.author.name : pkg.author),
    license: text(pkg.license),
    engines: text(pkg.engines?.fuyu),
    platforms: Array.isArray(app.platforms) ? app.platforms.filter((item) => typeof item === "string") : [],
    links: { repository, homepage: webUrl(pkg.homepage), bugs: webUrl(pkg.bugs), funding: webUrl(Array.isArray(pkg.funding) ? pkg.funding[0] : pkg.funding) },
    readme: Object.fromEntries(PREVIEW_LOCALES.map((locale) => [locale, readme(root, locale)])),
  };
  return { root, pkg, model, warnings };
}

async function appStyles() {
  const { default: styles } = await import("./preview/app-styles.json", { with: { type: "json" } });
  return styles.css;
}

function only(value, all, flag) {
  if (value === undefined) return [...all];
  if (!all.includes(value)) throw new BuildError(`${flag} is ${all.join(" or ")}`);
  return [value];
}

async function capture(file, stages, env) {
  const images = [];
  await withBrowser(
    async (page) => {
      await page.open(pathToFileURL(file).href);
      await page.until("document.readyState === 'complete' && [...document.images].every((image) => image.complete)", "the preview page");
      for (const { theme, locale } of stages) {
        const rect = await page.evaluate(`(() => { const box = document.querySelector('[data-theme="${theme}"][data-locale="${locale}"]').getBoundingClientRect(); return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }; })()`);
        const target = file.replace(/\.html?$/i, "") + `-${theme}-${locale}.png`;
        writeFileSync(target, await page.capture({ x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) }));
        images.push({ file: target, theme, locale });
      }
    },
    { env, width: 960, height: 1200, scale: 2 },
  );
  return images;
}

export function openInBrowser(file) {
  const [program, args] = process.platform === "darwin" ? ["open", [file]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : ["xdg-open", [file]];
  spawn(program, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

export async function preview(dir, options = {}) {
  const themes = only(options.theme, PREVIEW_THEMES, "--theme");
  const locales = only(options.locale, PREVIEW_LOCALES, "--locale");
  const { root, pkg, model, warnings } = previewModel(dir, options);
  const listing = lintListing(root, pkg, { appKey: options.appKey });
  const file = resolve(root, options.out ?? DEFAULT_PREVIEW_FILE);
  const notes = [...warnings, ...listing].map((issue) => `${issue.path ?? issue.file ?? "plugin"}: ${issue.message}`);
  const css = await appStyles();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, previewPage({ model, css, themes, locales, notes }));
  const stages = locales.flatMap((locale) => themes.map((theme) => ({ theme, locale })));
  const images = options.png ? await capture(file, stages, options.env) : [];
  if (options.open) openInBrowser(file);
  return { dir: root, file, images, stages, warnings, listing };
}
