import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { constants } from "node:os";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditLight, MIN_CONTRAST, SKIPPED_PAGES, pageName } from "./regression-contrast.mjs";
import { connect, PIPE_STDIO } from "./regression/cdp.mjs";
import { captureSnapshot, prepareSnapshotBrowser, settledSnapshot } from "./regression/snapshots.mjs";

export const PAGES = [
  "agent-alert-card.html",
  "agent-alerts.html",
  "agent-approvals.html",
  "agent-sessions.html?test=1",
  "agent-sessions-interact.html",
  "agent-list-motion.html",
  "calendar.html",
  "center-pattern.html?test=1",
  "claude-usage.html?test=1",
  "session-ring.html?test=1",
  "collapsed-message-animation.html?test=1",
  "collapsed-slots.html?test=1",
  "dev-build.html",
  "notch-island.html?test=1",
  "island-forms.html?test=1",
  "bottom-island.html?test=1",
  "side-island.html?test=1",
  "island-colors.html?test=1",
  "message-banner.html?test=1",
  "message-panel.html?test=1",
  "i18n.html?test=1",
  "mail-reader.html?run=1",
  "music-lyrics.html",
  "notification-startup.html",
  "onboarding.html?test=1",
  "onboarding-push.html?test=1",
  "plugin-info.html",
  "plugin-menus.html",
  "plugin-views.html?test=1",
  "plugins-v3.html",
  "plugin-slot.html",
  "settings.html?test=1",
  "settings-sidebar.html",
  "settings-search.html",
  "settings-feature-off.html",
  "agent-remote.html",
  "ssh-tunnel.html",
  "tucked-hover.html",
  "update-reminder.html?test=1",
  "version-history.html",
  "liquid-glass.html?test=1",
  "list-pages.html?test=1",
  "clipboard-popup.html?test=1",
  "clipboard-preview.html?test=1",
  "screenshot-overlay.html",
  "screenshot-pin.html",
  "screenshot-card.html",
  "clipboard-notice.html",
  "clipboard-links.html",
  "screenshot-history.html",
  "screenshot-measure.html",
  "screenshot-record.html",
  "recording-notice.html",
  "timer.html",
  "todo-island.html",
  "todo-date-picker.html",
];

const PAGE_TIMEOUT_MS = 120_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export function pageOutcome({ testResult = "", dataResult = "", text = "" }) {
  const marker = testResult || dataResult;
  if (marker === "passed" || marker === "failed") return marker;
  if (/^ALL PASS/m.test(text) || /全部 \d+ 项检查通过/.test(text)) return "passed";
  if (/^SOME FAILED/m.test(text) || /^FAIL /m.test(text)) return "failed";
  return null;
}

export function passedChecks(text) {
  return (text.match(/^PASS /gm) ?? []).length;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
  const browser = process.env.CHROME_PATH ?? BROWSERS.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error("No Chrome or Edge found; set CHROME_PATH.");
  return browser;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`${url} did not answer within ${timeoutMs / 1000}s`);
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const BROWSER_START_MS = 60_000;
const PROFILE_PREFIX = "fly-regression-";
const STALE_PROFILE_MS = 24 * 60 * 60 * 1000;
const EXIT_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];

export function removeStaleProfiles(dir, now = Date.now()) {
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(PROFILE_PREFIX)) continue;
    const profile = path.join(dir, name);
    try {
      if (now - statSync(profile).mtimeMs < STALE_PROFILE_MS) continue;
      rmSync(profile, { recursive: true, force: true });
      removed.push(name);
    } catch {}
  }
  return removed;
}

const READ_STATE = `(() => {
  const results = document.getElementById("results");
  return JSON.stringify({
    testResult: document.documentElement.dataset.testResult ?? "",
    dataResult: results?.dataset.result ?? "",
    text: results?.textContent ?? "",
  });
})()`;

export async function runPage(session, url) {
  session.errors.length = 0;
  await session.send("Page.navigate", { url });
  const deadline = Date.now() + PAGE_TIMEOUT_MS;
  let state = {};
  while (Date.now() < deadline) {
    await sleep(500);
    const { result } = await session.send("Runtime.evaluate", { expression: READ_STATE, returnByValue: true });
    try { state = JSON.parse(result?.value ?? "{}"); } catch { state = {}; }
    const outcome = pageOutcome(state);
    if (outcome) return { outcome, state, errors: [...session.errors] };
  }
  return { outcome: "timed out", state, errors: [...session.errors] };
}

export async function withRegressionBrowser(root, firstPage, use) {
  removeStaleProfiles(tmpdir());
  const vitePort = Number(process.env.REGRESSION_PORT ?? await freePort());
  const base = `http://127.0.0.1:${vitePort}/tests/regression/`;
  const profile = mkdtempSync(path.join(tmpdir(), PROFILE_PREFIX));
  let browser;
  let vite;
  const stopOnSignal = (signal) => {
    browser?.kill("SIGKILL");
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    process.exit(128 + (constants.signals[signal] ?? 0));
  };
  for (const signal of EXIT_SIGNALS) process.on(signal, stopOnSignal);
  try {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ root, logLevel: "silent", server: { port: vitePort, strictPort: true, host: "127.0.0.1" } });
    await vite.listen();
    await waitForHttp(`${base}${firstPage.split("?")[0]}`, 30_000);
    const language = process.env.REGRESSION_LANG ?? "zh-CN";
    browser = spawn(findBrowser(), ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-pipe", `--user-data-dir=${profile}`, `--lang=${language}`, `--accept-lang=${language}`, `--user-agent=${USER_AGENT}`,"--window-size=1280,900", "about:blank"], { stdio: PIPE_STDIO });
    let browserLog = "";
    browser.stderr.on("data", (chunk) => { browserLog = (browserLog + chunk).slice(-4000); });
    const session = await connect(browser, () => browserLog, BROWSER_START_MS);
    const result = await use({ session, base });
    session.close();
    return result;
  } finally {
    browser?.kill();
    await vite?.close();
    for (const signal of EXIT_SIGNALS) process.off(signal, stopOnSignal);
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`Could not remove ${profile}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const update = args.includes("--update-snapshots");
  const filters = args.filter((arg) => !arg.startsWith("--"));
  const pages = PAGES.filter((page) => filters.length === 0 || filters.some((word) => page.includes(word)));
  if (pages.length === 0) throw new Error(`No regression page matches ${filters.join(", ")}.`);
  let failed = 0;
  const contrastAllowlist = JSON.parse(readFileSync(path.join(root, "tests/regression/contrast-allowlist.json"), "utf8")).pages;
  const snapshotTally = { same: 0, created: 0, updated: 0, removed: 0 };
  let darkActual = null;
  const snapshot = async (session, page, variant) => {
    const outcome = await settledSnapshot({ root, page, variant, update, darkActual, capture: () => captureSnapshot(session), sleep });
    if (variant === "dark") darkActual = outcome.actual;
    if (outcome.late) console.log(`    snapshot settled late: ${outcome.label} (the page reported its result before its DOM stopped changing)`);
    if (outcome.status in snapshotTally) {
      snapshotTally[outcome.status] += 1;
      if (outcome.status !== "same") console.log(`    snapshot ${outcome.status}: ${outcome.label}`);
      return true;
    }
    if (outcome.status === "missing") console.log(`✗ ${page}  no snapshot ${outcome.label}; run pnpm test:regression --update-snapshots`);
    else if (outcome.status === "unsettled") console.log(`✗ ${page}  ${variant} DOM is still changing after the page reported its result; ${outcome.label} not written (${outcome.diff.changes} changed lines between two captures)`);
    else console.log(`✗ ${page}  ${variant} DOM differs from ${outcome.label} (${outcome.diff.changes} changed lines; pnpm test:regression --update-snapshots if intended)`);
    if (outcome.diff) for (const line of outcome.diff.text.split("\n")) console.log(`    ${line}`);
    return false;
  };
  await withRegressionBrowser(root, pages[0], async ({ session, base }) => {
    await prepareSnapshotBrowser(session);
    for (const page of pages) {
      const started = Date.now();
      const { outcome, state, errors } = await runPage(session, base + page);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`${outcome === "passed" ? "✓" : "✗"} ${page}  ${outcome}, ${passedChecks(state.text ?? "")} checks, ${seconds}s`);
      if (outcome === "passed") {
        let pagePassed = await snapshot(session, page, "dark");
        const findings = await auditLight(session, page, contrastAllowlist);
        if (!SKIPPED_PAGES.includes(pageName(page))) pagePassed = await snapshot(session, page, "light") && pagePassed;
        if (findings.length > 0) pagePassed = false;
        if (!pagePassed) failed += 1;
        if (findings.length > 0) {
          console.log(`✗ ${page}  light island: ${findings.length} text(s) under ${MIN_CONTRAST}:1`);
          for (const { key, ratio, text, color, background } of findings.slice(0, 8)) console.log(`    ${ratio} ${key} "${text}" ${color} on ${background}`);
        }
      } else {
        failed += 1;
        const lines = (state.text ?? "").split("\n").filter((line) => line.trim());
        for (const line of lines.filter((line) => !line.startsWith("PASS ")).slice(-5)) console.log(`    ${line}`);
        for (const error of errors.slice(0, 3)) console.log(`    ${error.split("\n")[0]}`);
      }
    }
  });
  const { same, created, updated, removed } = snapshotTally;
  console.log(`Snapshots: ${same} unchanged${created + updated + removed ? `, ${created} created, ${updated} updated, ${removed} removed` : ""}.`);
  console.log(failed === 0 ? `All ${pages.length} regression pages passed.` : `${failed} of ${pages.length} regression pages did not pass.`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
