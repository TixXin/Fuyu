import type { ClipboardHistoryItem } from "./api";

export type ContentKind =
  | { kind: "link"; url: URL }
  | { kind: "color"; color: Rgba }
  | { kind: "json"; value: unknown };

export type Rgba = { r: number; g: number; b: number; a: number };

const MAX_SNIFF_LENGTH = 20_000;

export function contentKind(item: ClipboardHistoryItem): ContentKind | null {
  if (kinds.has(item)) return kinds.get(item) ?? null;
  const kind = sniff(item);
  kinds.set(item, kind);
  return kind;
}

const kinds = new WeakMap<ClipboardHistoryItem, ContentKind | null>();

function sniff(item: ClipboardHistoryItem): ContentKind | null {
  if (item.kind !== "text" || item.masked) return null;
  const text = (item.text ?? item.preview).trim();
  if (!text || text.length > MAX_SNIFF_LENGTH) return null;
  const url = parseLink(text);
  if (url) return { kind: "link", url };
  const color = parseColor(text);
  if (color) return { kind: "color", color };
  if (/^[[{]/.test(text) && /[\]}]$/.test(text)) {
    try {
      return { kind: "json", value: JSON.parse(text) };
    } catch {
      return null;
    }
  }
  return null;
}

const BARE_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24})(?::\d{2,5})?(?:[/?#]\S*)?$/i;
const FILE_ENDINGS = new Set(["md", "rs", "py", "sh", "js", "ts", "tsx", "jsx", "json", "toml", "yml", "yaml", "txt", "log", "png", "jpg", "jpeg", "gif", "webp", "zip", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "exe", "dmg", "app", "lock", "html", "css", "mjs", "cs", "go", "rb", "pl", "ps1", "bat", "cmd", "dll", "so", "msi", "pkg", "heic", "mov", "mp4", "mp3", "wav"]);

export function parseLink(text: string): URL | null {
  if (/^https?:\/\/\S+$/i.test(text)) {
    try {
      const url = new URL(text);
      return url.hostname.includes(".") || url.hostname === "localhost" ? url : null;
    } catch {
      return null;
    }
  }
  const bare = BARE_HOST.exec(text);
  if (!bare || FILE_ENDINGS.has(bare[1].toLowerCase()) || /^\d+(\.\d+)+$/.test(text)) return null;
  try {
    return new URL(`https://${text}`);
  } catch {
    return null;
  }
}

export function linkLabel(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return host;
  const head = parts.slice(0, 2).join("/");
  const rest = parts.slice(2).join("/");
  return [host, head, rest].filter(Boolean).join(" › ");
}

const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|spm|scm|from|share_source|share_medium|share_plat|share_tag|vd_source|si|ref_src|ref_url)$/i;

export function stripTracking(text: string): string {
  const url = parseLink(text.trim());
  if (!url) return text;
  const kept = [...url.searchParams].filter(([key]) => !TRACKING.test(key));
  if (kept.length === [...url.searchParams].length) return text;
  url.search = new URLSearchParams(kept).toString();
  return url.toString();
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

export function parseColor(text: string): Rgba | null {
  const value = text.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const channel = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? Math.round((channel(3) / 255) * 100) / 100 : 1 };
  }
  const fn = /^(rgba?|hsla?)\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(value);
  if (!fn) return null;
  const [, name, x, y, z, alpha] = fn;
  const a = alpha === undefined ? 1 : clamp(alpha.endsWith("%") ? parseFloat(alpha) / 100 : parseFloat(alpha), 1);
  if (name.startsWith("rgb")) {
    const channel = (part: string) => Math.round(clamp(part.endsWith("%") ? (parseFloat(part) * 255) / 100 : parseFloat(part), 255));
    return { r: channel(x), g: channel(y), b: channel(z), a };
  }
  return { ...hslToRgb(parseFloat(x), clamp(parseFloat(y), 100) / 100, clamp(parseFloat(z), 100) / 100), a };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function colorFormats({ r, g, b, a }: Rgba): { hex: string; rgb: string; hsl: string } {
  const hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0").toUpperCase() : ""}`;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    hue = max === rn ? 60 * (((gn - bn) / delta) % 6) : max === gn ? 60 * ((bn - rn) / delta + 2) : 60 * ((rn - gn) / delta + 4);
  }
  const h = Math.round((hue + 360) % 360);
  const s = Math.round(saturation * 100);
  const l = Math.round(lightness * 100);
  return {
    hex,
    rgb: a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`,
    hsl: a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`,
  };
}
