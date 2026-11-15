import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SNAPSHOT_DIR = "tests/regression/snapshots";
export const SNAPSHOT_TIMEZONE = "Asia/Shanghai";
export const FROZEN_START = "2026-11-15T10:00:00+08:00";

export const FREEZE_CLOCK = `(() => {
  const RealDate = Date;
  const offset = RealDate.parse("${FROZEN_START}") - RealDate.now();
  const now = () => RealDate.now() + offset;
  function FrozenDate(...args) {
    if (!new.target) return new RealDate(now()).toString();
    return args.length ? new RealDate(...args) : new RealDate(now());
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = now;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  Object.defineProperty(RealDate.prototype, "constructor", { value: FrozenDate, configurable: true, writable: true });
  globalThis.Date = FrozenDate;
})();`;

export async function prepareSnapshotBrowser(session) {
  await session.send("Emulation.setTimezoneOverride", { timezoneId: SNAPSHOT_TIMEZONE });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE_CLOCK });
}

export const CAPTURE = `(async () => {
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) {
      const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity);
      if (running.length === 0) break;
      await Promise.race([Promise.all(running.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1000))]);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  await settle();
  const ids = new Map();
  const reactId = /_[rR]_[0-9a-zA-Z]+_|«[rR][0-9a-zA-Z]+»|:[rR][0-9a-zA-Z]+:/g;
  const stableId = (value) => value.replace(reactId, (id) => {
    if (!ids.has(id)) ids.set(id, "_id" + (ids.size + 1) + "_");
    return ids.get(id);
  });
  const volatile = (value) => value
    .replace(/\\b1[6-9]\\d{8}(?:\\d{3})?\\b/g, "<ts>")
    .replace(/blob:[^\\s"')]+/g, "blob:<url>");
  const unstableStyle = /^(transition|animation|will-change)(-|$)|^--wave-/;
  const LIVE_TEXT = [".timer-panel__time"];
  const cleanStyle = (value) => value.split(";").map((d) => d.trim()).filter((d) => d && !unstableStyle.test(d.split(":")[0].trim())).join("; ");
  const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapeAttr = (s) => escapeText(s).replace(/"/g, "&quot;");
  const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const SKIP = new Set(["script", "style", "template", "noscript"]);
  const lines = [];
  const walk = (node, depth) => {
    const pad = "  ".repeat(depth);
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\\s+/g, " ").trim();
      if (!text) return;
      const live = LIVE_TEXT.some((selector) => node.parentElement?.closest(selector));
      lines.push(pad + escapeText(live ? text.replace(/\\d/g, "#") : volatile(stableId(text))));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (SKIP.has(tag) || node.id === "results") return;
    const attrs = [...node.attributes].map((a) => {
      let value = volatile(stableId(a.value));
      if (a.name === "style") value = cleanStyle(value);
      if (a.name === "class") value = value.split(/\\s+/).filter(Boolean).join(" ");
      return [a.name, value];
    }).filter(([name, value]) => !(name === "style" && value === "")).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const open = "<" + tag + attrs.map(([n, v]) => " " + n + '="' + escapeAttr(v) + '"').join("") + ">";
    const children = [...node.childNodes];
    if (VOID.has(tag)) { lines.push(pad + open); return; }
    const before = lines.length;
    lines.push(pad + open);
    for (const child of children) walk(child, depth + 1);
    if (lines.length === before + 1) lines[before] += "</" + tag + ">";
    else lines.push(pad + "</" + tag + ">");
  };
  walk(document.body, 0);
  return lines.join("\\n") + "\\n";
})()`;

export const snapshotFile = (root, page, variant) => path.join(root, SNAPSHOT_DIR, `${page.split("?")[0].replace(/\.html$/, "")}${variant === "light" ? ".light" : ""}.html`);

export async function captureSnapshot(session) {
  const { result, exceptionDetails } = await session.send("Runtime.evaluate", { expression: CAPTURE, awaitPromise: true, returnByValue: true });
  if (exceptionDetails || typeof result?.value !== "string") throw new Error(`Snapshot capture failed: ${exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? "no value"}`);
  return result.value;
}

export function lineDiff(expected, actual, context = 2, limit = 6) {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const n = a.length;
  const m = b.length;
  if (n * m > 25_000_000) return firstMismatch(a, b, context);
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { ops.push([" ", a[i], i]); i += 1; j += 1; }
    else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) { ops.push(["-", a[i], i]); i += 1; }
    else { ops.push(["+", b[j], i]); j += 1; }
  }
  const hunks = [];
  let changes = 0;
  for (let k = 0; k < ops.length; k += 1) {
    if (ops[k][0] === " ") continue;
    changes += 1;
    const start = Math.max(0, k - context);
    let end = k;
    while (end + 1 < ops.length && (ops[end + 1][0] !== " " || ops.slice(end + 1, end + 1 + context * 2).some((op) => op[0] !== " "))) end += 1;
    end = Math.min(ops.length - 1, end + context);
    if (hunks.length < limit) hunks.push([`@@ line ${ops[start][2] + 1}`, ...ops.slice(start, end + 1).map(([sign, line]) => `${sign} ${line}`)].join("\n"));
    changes += ops.slice(k + 1, end + 1).filter((op) => op[0] !== " ").length;
    k = end;
  }
  return { changes, text: hunks.join("\n") };
}

function firstMismatch(a, b, context) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - context);
  const lines = [`@@ line ${i + 1}`, ...a.slice(from, i).map((l) => `  ${l}`), ...a.slice(i, i + 3).map((l) => `- ${l}`), ...b.slice(i, i + 3).map((l) => `+ ${l}`)];
  return { changes: 1, text: lines.join("\n") };
}

export function compareSnapshot(root, page, variant, actual, update, darkActual = null) {
  const file = snapshotFile(root, page, variant);
  const label = path.relative(root, file);
  const previous = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
  const sharesDark = variant === "light" && darkActual !== null && actual === darkActual;
  if (update) {
    if (sharesDark) {
      if (previous === null) return { status: "same", label };
      rmSync(file);
      return { status: "removed", label };
    }
    if (previous === actual) return { status: "same", label };
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, actual);
    return { status: previous === null ? "created" : "updated", label };
  }
  if (previous === null && variant === "light") {
    if (sharesDark) return { status: "same", label };
    const darkFile = snapshotFile(root, page, "dark");
    if (!existsSync(darkFile)) return { status: "missing", label };
    return { status: "changed", label, diff: lineDiff(readFileSync(darkFile, "utf8").replace(/\r\n/g, "\n"), actual) };
  }
  if (previous === null) return { status: "missing", label };
  if (previous === actual) return { status: "same", label };
  return { status: "changed", label, diff: lineDiff(previous, actual) };
}
