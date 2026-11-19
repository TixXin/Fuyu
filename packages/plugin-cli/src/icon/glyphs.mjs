const SHAPES = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"];
const OWN_PAINT = /\s(?:fill|stroke|style|class)\s*=/;

let loaded = null;

export async function loadGlyphs() {
  loaded ??= import("./lucide.json", { with: { type: "json" } }).then((module) => module.default);
  return loaded;
}

export async function findGlyph(name) {
  const { icons, aliases } = await loadGlyphs();
  const key = String(name).trim().toLowerCase();
  const target = Object.hasOwn(icons, key) ? key : Object.hasOwn(aliases, key) ? aliases[key] : null;
  return target ? { name: target, body: icons[target] } : null;
}

export async function searchGlyphs(word, limit = Infinity) {
  const { icons, aliases } = await loadGlyphs();
  const text = String(word).trim().toLowerCase();
  const names = new Set(Object.keys(icons).filter((name) => name.includes(text)));
  for (const [alias, target] of Object.entries(aliases)) if (alias.includes(text)) names.add(target);
  const ranked = [...names].sort((a, b) => Number(b.startsWith(text)) - Number(a.startsWith(text)) || a.length - b.length || a.localeCompare(b));
  return ranked.slice(0, limit);
}

export function glyphFromSvg(text) {
  const svg = /<svg\b[^>]*>([\s\S]*)<\/svg>/i.exec(text);
  if (!svg) return { body: null, problem: "not an SVG file" };
  const group = /<g\b[^>]*>([\s\S]*)<\/g>/i.exec(svg[1]);
  const inner = (group ? group[1] : svg[1]).replace(/<!--[\s\S]*?-->/g, "");
  const foreign = [...inner.matchAll(/<([a-zA-Z][\w-]*)/g)].map((match) => match[1]).find((tag) => !SHAPES.includes(tag));
  if (foreign) return { body: null, problem: `<${foreign}> cannot be used; draw with ${SHAPES.join(", ")}` };
  const tags = [...inner.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*?)\/?>(?:\s*<\/\1>)?/g)];
  const rest = inner.replace(/<([a-zA-Z][\w-]*)\b([^>]*?)\/?>(?:\s*<\/\1>)?/g, "").trim();
  if (tags.length === 0) return { body: null, problem: "no shapes found" };
  if (rest) return { body: null, problem: `only ${SHAPES.join(", ")} elements can be used, found: ${rest.slice(0, 40)}` };
  const parts = [];
  for (const [, tag, attrs] of tags) {
    if (OWN_PAINT.test(attrs)) return { body: null, problem: `<${tag}> sets its own fill, stroke, style or class; the glyph takes its colour from the icon` };
    parts.push(`<${tag}${attrs.replace(/\s+/g, " ").trimEnd()}/>`);
  }
  return { body: parts.join(""), problem: null };
}
