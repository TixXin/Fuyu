import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isSafeRelativePath } from "@fuyu/plugin-manifest";
import { BuildError } from "./errors.mjs";
import { findGlyph, glyphFromSvg, searchGlyphs } from "./icon/glyphs.mjs";
import { assessTone, normalizeColor } from "./icon/tones.mjs";

export const DEFAULT_ICON_FILE = "assets/icon.svg";
export const ICON_TINT = "0.16";
export const ICON_GLYPH_TRANSFORM = "translate(5.28 5.28) scale(0.56)";

export function renderIcon({ body, color }) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256">',
    `<rect width="24" height="24" rx="6" fill="${color}" fill-opacity="${ICON_TINT}"/>`,
    `<g transform="${ICON_GLYPH_TRANSFORM}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    body,
    "</g></svg>\n",
  ].join("");
}

function readPackage(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

async function resolveGlyph(dir, glyph) {
  if (glyph.toLowerCase().endsWith(".svg")) {
    const file = resolve(dir, glyph);
    if (!existsSync(file)) throw new BuildError(`no glyph file at ${file}`);
    const { body, problem } = glyphFromSvg(readFileSync(file, "utf8"));
    if (!body) throw new BuildError(`${glyph} cannot be used as the glyph: ${problem}`);
    return { name: glyph, body };
  }
  const found = await findGlyph(glyph);
  if (found) return found;
  const similar = await searchGlyphs(glyph.split("-")[0], 12);
  throw new BuildError(`"${glyph}" is not a lucide icon name${similar.length ? ` (did you mean: ${similar.join(", ")})` : ""}; see https://lucide.dev/icons or run fuyu-plugin icon --search <word>`);
}

export async function icon(dir, options = {}) {
  const root = resolve(dir);
  const appKey = options.appKey ?? "fuyu";
  const color = normalizeColor(options.color);
  if (!color) throw new BuildError(`--color must be a colour such as #f08a24, got ${JSON.stringify(options.color ?? "")}`);
  if (typeof options.glyph !== "string" || options.glyph.trim() === "") throw new BuildError("--glyph must be a lucide icon name such as alarm-clock, or an .svg file with your own drawing");
  const pkg = readPackage(root);
  const declared = pkg?.[appKey]?.icon;
  let target = options.out;
  if (!target) {
    if (typeof declared === "string" && !declared.toLowerCase().endsWith(".svg")) {
      throw new BuildError(`${appKey}.icon is ${declared}; change it to ${DEFAULT_ICON_FILE} or pass --out`);
    }
    target = typeof declared === "string" && isSafeRelativePath(declared) ? declared : DEFAULT_ICON_FILE;
  }
  const file = resolve(root, target);
  const glyph = await resolveGlyph(root, options.glyph.trim());
  const replaced = existsSync(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderIcon({ body: glyph.body, color }));
  return { file, glyph: glyph.name, color, replaced, notes: assessTone(color, { except: typeof pkg?.name === "string" ? pkg.name : null }) };
}
