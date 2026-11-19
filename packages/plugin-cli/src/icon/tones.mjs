export const OFFICIAL_ICONS = Object.freeze({
  "@fuyu/alarm": { color: "#f08a24", glyph: "alarm-clock" },
  "@fuyu/countdown": { color: "#6f7dfa", glyph: "calendar-clock" },
  "@fuyu/ecdict": { color: "#3b94f5", glyph: "book-a" },
  "@fuyu/github-issues": { color: "#9575f5", glyph: "circle-dot" },
  "@fuyu/launcher": { color: "#e0a020", glyph: "rocket" },
  "@fuyu/now-playing": { color: "#f0559a", glyph: "music-2" },
  "@fuyu/pomodoro": { color: "#f25a4c", glyph: null },
  "@fuyu/system-monitor": { color: "#1fb877", glyph: "activity" },
  "@fuyu/todo-digest": { color: "#1fb5b5", glyph: "list-checks" },
  "@fuyu/todo-ring": { color: "#4fbf4a", glyph: "circle-check-big" },
  "@fuyu/weather": { color: "#22a8ee", glyph: "cloud-sun" },
  "@fuyu/world-clock": { color: "#4f8cf7", glyph: null },
});

export const CLOSE_DISTANCE = 0.05;
export const LIGHTNESS_RANGE = Object.freeze([0.55, 0.8]);
export const MIN_CHROMA = 0.08;

const HEX = /^#[0-9a-f]{6}$/;

export function normalizeColor(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return HEX.test(text) ? text : null;
}

export function toOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function toneDistance(a, b) {
  const [x, y] = [toOklab(a), toOklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export function assessTone(color, { except = null, taken = OFFICIAL_ICONS } = {}) {
  const notes = [];
  const [lightness, a, b] = toOklab(color);
  if (Math.hypot(a, b) < MIN_CHROMA) notes.push({ code: "icon:grey", message: `${color} is close to grey; pick a colour that stands out on dark and light backgrounds` });
  else if (lightness < LIGHTNESS_RANGE[0]) notes.push({ code: "icon:dark", message: `${color} is dark and will be hard to see on a dark background; pick a mid-tone` });
  else if (lightness > LIGHTNESS_RANGE[1]) notes.push({ code: "icon:light", message: `${color} is light and will be hard to see on a light background; pick a mid-tone` });
  const near = Object.entries(taken)
    .filter(([id]) => id !== except)
    .map(([id, entry]) => ({ id, color: entry.color, distance: toneDistance(color, entry.color) }))
    .filter((entry) => entry.distance < CLOSE_DISTANCE)
    .sort((x, y) => x.distance - y.distance);
  for (const entry of near) {
    notes.push({
      code: entry.distance === 0 ? "icon:same-colour" : "icon:close-colour",
      message: entry.distance === 0 ? `${color} is the colour of the official plugin ${entry.id}` : `${color} is close to ${entry.color} of the official plugin ${entry.id}`,
    });
  }
  return notes;
}
