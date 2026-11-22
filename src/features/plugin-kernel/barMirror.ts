export const ISLAND_MIRROR_REQUEST = "island-mirror-request";
export const ISLAND_MIRROR_FRAME = "island-mirror-frame";

export const MIRROR_INHERITED = [
  "color", "font-family", "font-size", "font-style", "font-weight", "font-stretch", "font-variant-numeric", "font-variant-caps", "font-variant-ligatures",
  "font-feature-settings", "font-kerning", "font-optical-sizing", "font-variation-settings", "line-height", "letter-spacing", "word-spacing",
  "text-align", "text-indent", "text-transform", "text-rendering", "text-shadow", "white-space", "white-space-collapse", "text-wrap-mode", "text-wrap-style",
  "word-break", "overflow-wrap", "tab-size", "hyphens", "direction", "writing-mode", "visibility", "list-style-type", "list-style-position",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
  "stroke-dasharray", "stroke-dashoffset", "paint-order", "text-anchor", "color-scheme", "-webkit-font-smoothing", "-webkit-text-fill-color",
  "-webkit-text-stroke-color", "-webkit-text-stroke-width", "border-collapse", "quotes", "image-rendering",
] as const;
export const MIRROR_SHEET = `:host { all: initial; display: block; pointer-events: none; } * { ${MIRROR_INHERITED.map((name) => `${name}: inherit`).join("; ")} }`;

export const MIRROR_HTML_LIMIT = 600_000;
const MIRROR_ITEM_LIMIT = 80;
const MIRROR_FORMS = ["bar", "notch", "taskbar", "side"] as const;

export type MirrorForm = (typeof MIRROR_FORMS)[number];
export interface MirrorBox { left: number; top: number; width: number; height: number }
export interface MirrorItem { id: string; box: MirrorBox }

export type MirrorMiss = "away" | "big";

export interface MirrorFrame {
  shown: boolean;
  miss: MirrorMiss | null;
  form: MirrorForm;
  width: number;
  height: number;
  html: string;
  items: MirrorItem[];
  more: MirrorBox | null;
  middle: MirrorBox | null;
  center: MirrorBox | null;
}

const size = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 10_000 ? value : null);

function readBox(value: unknown): MirrorBox | null {
  if (!value || typeof value !== "object") return null;
  const { left, top, width, height } = value as Record<string, unknown>;
  const [w, h] = [size(width), size(height)];
  if (typeof left !== "number" || typeof top !== "number" || !Number.isFinite(left) || !Number.isFinite(top) || w === null || h === null || w === 0 || h === 0) return null;
  return { left, top, width: w, height: h };
}

export function readMirrorFrame(payload: unknown): MirrorFrame | null {
  if (!payload || typeof payload !== "object") return null;
  const { shown, miss, form, width, height, html, items, more, middle, center } = payload as Record<string, unknown>;
  const [w, h] = [size(width), size(height)];
  if (typeof html !== "string" || html.length > MIRROR_HTML_LIMIT || w === null || h === null || !Array.isArray(items)) return null;
  const read = items.slice(0, MIRROR_ITEM_LIMIT).flatMap((item): MirrorItem[] => {
    if (!item || typeof item !== "object") return [];
    const { id, box } = item as Record<string, unknown>;
    const area = readBox(box);
    return typeof id === "string" && id !== "" && area ? [{ id, box: area }] : [];
  });
  return {
    shown: shown === true && html !== "" && w > 0 && h > 0,
    miss: miss === "away" || miss === "big" ? miss : null,
    form: MIRROR_FORMS.find((known) => known === form) ?? "bar",
    width: w,
    height: h,
    html,
    items: read,
    more: readBox(more),
    middle: readBox(middle),
    center: readBox(center),
  };
}
