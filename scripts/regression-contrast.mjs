export const MIN_CONTRAST = 3;

export const SKIPPED_PAGES = ["screenshot-overlay.html"];

export const LIGHT_AUDIT = `(async () => {
  const LIGHT = "#f2f2f5";
  const fixtureRules = [];
  const collect = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) collect(rule.cssRules);
      else if (rule.selectorText) fixtureRules.push(rule);
    }
  };
  for (const sheet of document.styleSheets) {
    const node = sheet.ownerNode;
    if (node && node.tagName === "STYLE" && !node.hasAttribute("data-vite-dev-id")) {
      try { collect(sheet.cssRules); } catch {}
    }
  }
  const bgSelectors = fixtureRules.filter((r) => r.style.background || r.style.backgroundColor).map((r) => r.selectorText);
  const inkSelectors = fixtureRules.filter((r) => r.style.color).map((r) => r.selectorText);
  const style = document.createElement("style");
  style.textContent = [
    "*, *::before, *::after { transition: none !important; animation: none !important; }",
    "html.island-light, html.island-light * { --island-fill: rgba(242, 242, 245, 1) !important; --island-background-color: #f2f2f5 !important; --island-ink-rgb: 24, 24, 30 !important; --task-text-color: #1c1c1f !important; --glass-tint-color: rgba(242, 242, 245, 1) !important; --glass-collapsed-tint-color: rgba(242, 242, 245, 1) !important; }",
    "html.island-light, html.island-light body { background: " + LIGHT + " !important; }",
    ...bgSelectors.map((s) => ":is(" + s + ") { background: " + LIGHT + " !important; }"),
    ...inkSelectors.map((s) => ":is(" + s + ") { color: #18181e !important; }"),
  ].join("\\n");
  document.head.appendChild(style);
  document.documentElement.classList.add("island-light");
  for (const [root, modifier] of [["settings-stage", "settings-stage--light"], ["onboarding", "onboarding--light"]]) {
    document.querySelectorAll("." + root).forEach((el) => el.classList.add(modifier));
  }
  await new Promise((resolve) => setTimeout(resolve, 300));

  const parse = (c) => {
    const srgb = c.match(/^color\\(srgb ([^)]+)\\)/);
    if (srgb) {
      const p = srgb[1].split(/[ /]+/).filter(Boolean).map(Number);
      return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
    }
    const m = c.match(/^rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const matches = (el, selectors) => selectors.some((s) => { try { return el.matches(s); } catch { return false; } });
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage.includes("url(")) return null;
      const c = parse(cs.backgroundColor);
      if (!c) return null;
      if (c.a > 0) layers.push(c);
      if (c.a >= 0.98) break;
    }
    let base = parse("rgb(242, 242, 245)");
    for (let i = layers.length - 1; i >= 0; i -= 1) base = over(layers[i], base);
    return base;
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  const found = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.closest("pre, #results, script, style, [aria-hidden='true'], :disabled, [hidden]")) continue;
    if (matches(el, inkSelectors)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || cs.display === "none") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (opacity(el) < 0.6) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg) continue;
    const ink = over(fg, bg);
    const [hi, lo] = [lum(ink), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio >= ${MIN_CONTRAST}) continue;
    const cls = (el.getAttribute("class") || "").split(/\\s+/).filter(Boolean)[0];
    const key = el.tagName.toLowerCase() + (cls ? "." + cls : "");
    const prev = found.get(key);
    if (prev && prev.ratio <= ratio) continue;
    found.set(key, {
      key,
      ratio: Math.round(ratio * 100) / 100,
      text: el.textContent.trim().slice(0, 30),
      color: cs.color,
      background: "rgb(" + Math.round(bg.r) + ", " + Math.round(bg.g) + ", " + Math.round(bg.b) + ")",
    });
  }
  return JSON.stringify([...found.values()].sort((a, b) => a.ratio - b.ratio));
})()`;

export const pageName = (page) => page.split("?")[0];

export function unexpected(findings, allowlist, page) {
  const allowed = new Set(allowlist[pageName(page)] ?? []);
  return findings.filter(({ key }) => !allowed.has(key));
}

export async function auditLight(session, page, allowlist) {
  if (SKIPPED_PAGES.includes(pageName(page))) return [];
  const { result } = await session.send("Runtime.evaluate", { expression: LIGHT_AUDIT, awaitPromise: true, returnByValue: true });
  let findings = [];
  try { findings = JSON.parse(result?.value ?? "[]"); } catch { findings = []; }
  return unexpected(findings, allowlist, page);
}
