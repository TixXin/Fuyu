import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readManifest } from "./build.mjs";
import { sourceFor } from "./entries.mjs";
import { BuildError } from "./errors.mjs";
import { normalizeColor } from "./icon/tones.mjs";
import { withBrowser } from "./shots/browser.mjs";
import { bundleShots, findSample } from "./shots/bundle.mjs";
import { BAR_SLOT, PAGE_SIZE, PAGE_SLOT, coverPage, shotPage } from "./shots/harness.mjs";
import { createScratch } from "./sources.mjs";

export const DEFAULT_SHOTS_DIR = "screenshots";
export const DEFAULT_COVER_FILE = "cover.png";
export const DEFAULT_COVER_SIZE = Object.freeze({ width: 1280, height: 800 });
export const SHOT_SLOTS = Object.freeze([PAGE_SLOT, BAR_SLOT]);
export const STRIP_RATIO = 3.4;
const FALLBACK_COLOR = "#74d6ff";
const THEMES = ["dark", "light"];
const LOCALES = ["zh-CN", "en"];
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/;
const FIRST_RECT_FILL = /<rect\b[^>]*?\sfill=["'](#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})["']/;
const STATE = "window.__fuyuShots ? JSON.stringify(window.__fuyuShots) : null";

function iconColor(root, app) {
  if (typeof app.icon !== "string" || !app.icon.toLowerCase().endsWith(".svg")) return null;
  const file = join(root, app.icon);
  if (!existsSync(file)) return null;
  return normalizeColor(FIRST_RECT_FILL.exec(readFileSync(file, "utf8"))?.[1]);
}

function size(value, name, file) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 120 || value > 2000) throw new BuildError(`shots: ${file}: ${name} must be a whole number of pixels between 120 and 2000`);
  return value;
}

export function planShots(listed, defaults = {}) {
  const theme = defaults.theme ?? "dark";
  const locale = defaults.locale ?? "zh-CN";
  const has = (slot) => listed.items.some((item) => item.slot === slot);
  if (!Array.isArray(listed.shots)) {
    const plan = [];
    if (has(PAGE_SLOT)) plan.push({ slot: PAGE_SLOT, file: "page.png", id: null, theme, locale, width: null, height: null });
    if (has(BAR_SLOT)) plan.push({ slot: BAR_SLOT, file: "bar.png", id: null, theme, locale, width: null, height: null });
    if (plan.length === 0) throw new BuildError(`the plugin registers nothing in ${SHOT_SLOTS.join(" or ")}, the two places shots can capture`);
    return plan;
  }
  if (listed.shots.length === 0) throw new BuildError("the sample's shots list is empty");
  const files = new Set();
  return listed.shots.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new BuildError(`shots[${index}] must be an object such as { slot: "${PAGE_SLOT}", file: "page.png" }`);
    if (!SHOT_SLOTS.includes(entry.slot)) throw new BuildError(`shots[${index}].slot must be ${SHOT_SLOTS.join(" or ")}, got ${JSON.stringify(entry.slot ?? null)}`);
    if (typeof entry.file !== "string" || !FILE_NAME.test(entry.file)) throw new BuildError(`shots[${index}].file must be a .png file name such as page.png, got ${JSON.stringify(entry.file ?? null)}`);
    if (files.has(entry.file.toLowerCase())) throw new BuildError(`shots[${index}].file: ${entry.file} is used twice`);
    files.add(entry.file.toLowerCase());
    if (entry.theme !== undefined && !THEMES.includes(entry.theme)) throw new BuildError(`shots[${index}].theme must be ${THEMES.join(" or ")}`);
    if (entry.locale !== undefined && !LOCALES.includes(entry.locale)) throw new BuildError(`shots[${index}].locale must be ${LOCALES.join(" or ")}`);
    return {
      slot: entry.slot,
      file: entry.file,
      id: typeof entry.id === "string" ? entry.id : null,
      theme: entry.theme ?? theme,
      locale: entry.locale ?? locale,
      width: size(entry.width, "width", entry.file),
      height: size(entry.height, "height", entry.file),
    };
  });
}

function hashOf(shot) {
  const params = new URLSearchParams({ slot: shot.slot, theme: shot.theme, locale: shot.locale });
  if (shot.id) params.set("id", shot.id);
  if (shot.width) params.set("width", String(shot.width));
  if (shot.height) params.set("height", String(shot.height));
  return params.toString();
}

async function stateOf(page, what) {
  const state = JSON.parse(await page.until(STATE, what));
  if (state.state === "failed") throw new BuildError(`${what}: ${state.error}`);
  return state;
}

export async function shots(dir, options = {}) {
  const root = resolve(dir);
  const appKey = options.appKey ?? "fuyu";
  const pkg = readManifest(root);
  const app = pkg?.[appKey];
  if (!app || typeof app !== "object") throw new BuildError(`package.json has no ${appKey} section`);
  if (typeof app.client?.island !== "string") throw new BuildError(`shots captures the island page and the collapsed item, and this plugin has no island part (${appKey}.client.island)`);
  if (options.theme !== undefined && !THEMES.includes(options.theme)) throw new BuildError(`--theme is ${THEMES.join(" or ")}`);
  if (options.locale !== undefined && !LOCALES.includes(options.locale)) throw new BuildError(`--locale is ${LOCALES.join(" or ")}`);
  const scale = options.scale ?? 2;
  if (![1, 2, 3].includes(scale)) throw new BuildError("--scale is 1, 2 or 3");
  const client = join(root, sourceFor(root, app.client.island, `${appKey}.client.island`));
  const sample = options.sample ? resolve(root, options.sample) : findSample(root);
  if (options.sample && !existsSync(sample)) throw new BuildError(`no sample file at ${sample}`);
  const outDir = resolve(root, options.outDir ?? DEFAULT_SHOTS_DIR);
  const warnings = [];
  const given = options.color === undefined ? null : normalizeColor(options.color);
  if (options.color !== undefined && !given) throw new BuildError(`--color must be a colour such as #f08a24, got ${JSON.stringify(options.color)}`);
  const scratch = createScratch("fuyu-plugin-shots-page-");
  try {
    const bundled = await bundleShots({ dir: root, client, sample });
    warnings.push(...bundled.warnings);
    mkdirSync(scratch.root, { recursive: true });
    const pageFile = join(scratch.root, "shots.html");
    writeFileSync(pageFile, shotPage({ js: bundled.js, css: bundled.css, plugin: String(pkg.name ?? "") }));
    const url = pathToFileURL(pageFile).href;
    const files = [];
    const unanswered = new Set();
    let cover = null;
    await withBrowser(
      async (page) => {
        await page.open(`${url}?list#list`);
        const listed = await stateOf(page, "loading the plugin's island part");
        const plan = planShots(listed, { theme: options.theme, locale: options.locale });
        mkdirSync(outDir, { recursive: true });
        const images = [];
        for (const [index, shot] of plan.entries()) {
          await page.open(`${url}?shot=${index}#${hashOf(shot)}`);
          const state = await stateOf(page, shot.file);
          state.unanswered.forEach((method) => unanswered.add(method));
          if (state.empty) throw new BuildError(`${shot.file}: the ${shot.slot} component rendered nothing with this sample`);
          if (!state.settled) warnings.push({ code: "shots:unsettled", file: shot.file, message: "the page was still changing after 8 seconds; the screenshot shows it as it was then" });
          const clip = { x: Math.floor(state.rect.x), y: Math.floor(state.rect.y), width: Math.ceil(state.rect.width), height: Math.ceil(state.rect.height) };
          const image = await page.capture(clip);
          const file = join(outDir, shot.file);
          writeFileSync(file, image);
          images.push({ shot, image, clip });
          files.push({ file, slot: shot.slot, theme: shot.theme, locale: shot.locale, width: clip.width * scale, height: clip.height * scale });
        }
        if (options.cover === false) return;
        const source = images.find((entry) => entry.shot.slot === PAGE_SLOT) ?? images[0];
        const target = { ...DEFAULT_COVER_SIZE, ...options.coverSize };
        let color = given ?? iconColor(root, app);
        if (!color) {
          color = FALLBACK_COLOR;
          warnings.push({ code: "shots:cover-colour", message: `the icon has no tile colour to take, so the cover uses ${FALLBACK_COLOR}; pass --color or draw the icon with fuyu-plugin icon` });
        }
        const box = { width: Math.round(target.width / scale), height: Math.round(target.height / scale) };
        const coverFile = join(scratch.root, "cover.html");
        writeFileSync(coverFile, coverPage({ image: source.image, ...box, color, theme: source.shot.theme, strip: source.clip.width / source.clip.height > STRIP_RATIO }));
        await page.open(pathToFileURL(coverFile).href);
        await page.until("document.images.length === 1 && document.images[0].complete && document.images[0].naturalWidth > 0", "the cover image");
        const file = join(outDir, options.coverFile ?? DEFAULT_COVER_FILE);
        writeFileSync(file, await page.capture({ x: 0, y: 0, ...box }));
        cover = { file, color, from: source.shot.file, width: box.width * scale, height: box.height * scale };
      },
      { env: options.env, scale },
    );
    for (const method of [...unanswered].sort()) {
      warnings.push({ code: "shots:unanswered", message: `the sample has no answer for the host call "${method}"; add it to host.calls in ${sample ? "the sample" : "shots/sample.ts"}` });
    }
    return { dir: root, outDir, sample, files, cover, warnings };
  } finally {
    scratch.dispose();
  }
}
