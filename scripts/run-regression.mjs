import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { constants } from "node:os";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditLight, MIN_CONTRAST, SKIPPED_PAGES, pageName } from "./regression-contrast.mjs";
import { BUILTINS_OFF_PAGES } from "./regression/builtins-off-pages.mjs";
import { connect, PIPE_STDIO } from "./regression/cdp.mjs";
import { parseJobs, parseShard, readTimings, shardOf, slowestFirst } from "./regression/shards.mjs";
import { captureSnapshot, prepareSnapshotBrowser, settledSnapshot } from "./regression/snapshots.mjs";

export const PAGES = [
  "agent-alert-card.html",
  "agent-notice-stack.html?test=1",
  "agent-alerts.html",
  "agent-approvals.html",
  "agent-test-notice.html",
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
  "drag-grid.html?test=1",
  "notch-island.html?test=1",
  "notch-rim.html",
  "notch-settings.html",
  "island-forms.html?test=1",
  "bottom-island.html?test=1",
  "side-island.html?test=1",
  "tuck-hint.html?test=1",
  "island-resize.html?test=1",
  "island-colors.html?test=1",
  "message-banner.html?test=1",
  "message-panel.html?test=1",
  "track-notice.html?test=1",
  "i18n.html?test=1",
  "mail-reader.html?run=1",
  "messages-layouts.html?test=1",
  "music-lyrics.html",
  "cover-edge.html?test=1",
  "notification-startup.html",
  "onboarding.html?test=1",
  "onboarding-push.html?test=1",
  "icon-tooltip-hidden.html",
  "plugin-page.html",
  "plugin-page-en.html",
  "plugin-market.html",
  "plugin-market-en.html",
  "plugin-diagnostics.html",
  ...BUILTINS_OFF_PAGES,
  "todos-off.html",
  "plugin-slot.html",
  "plugin-detail-settings.html",
  "plugin-island-page.html",
  "widget-entrance.html",
  "plugin-collapsed-width.html",
  "settings.html?test=1",
  "settings-sidebar.html",
  "settings-search.html",
  "settings-feature-off.html",
  "sync-settings.html",
  "plugin-settings-open.html",
  "agent-remote.html",
  "ssh-tunnel.html",
  "tucked-hover.html",
  "update-reminder.html?test=1",
  "window-crash.html",
  "version-history.html",
  "liquid-glass.html?test=1",
  "list-pages.html?test=1",
  "clipboard-popup.html?test=1",
  "clipboard-preview.html?test=1",
  "clipboard-image-viewer.html?test=1",
  "tray-menu.html?test=1",
  "tray-menu-en.html?test=1",
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

const liveBrowsers = new Set();

function stopOnSignal(signal) {
  for (const { browser, profile } of liveBrowsers) {
    browser.kill("SIGKILL");
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }
  process.exit(128 + (constants.signals[signal] ?? 0));
}

export async function withRegressionVite(root, firstPage, use) {
  removeStaleProfiles(tmpdir());
  const vitePort = Number(process.env.REGRESSION_PORT ?? await freePort());
  const base = `http://127.0.0.1:${vitePort}/tests/regression/`;
  let vite;
  try {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ root, logLevel: "silent", server: { port: vitePort, strictPort: true, host: "127.0.0.1" } });
    await vite.listen();
    await waitForHttp(`${base}${firstPage.split("?")[0]}`, 30_000);
    return await use(base);
  } finally {
    await vite?.close();
  }
}

export async function withBrowser(use) {
  const profile = mkdtempSync(path.join(tmpdir(), PROFILE_PREFIX));
  const language = process.env.REGRESSION_LANG ?? "zh-CN";
  const browser = spawn(findBrowser(), ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-pipe", `--user-data-dir=${profile}`, `--lang=${language}`, `--accept-lang=${language}`, `--user-agent=${USER_AGENT}`,"--window-size=1280,900", "about:blank"], { stdio: PIPE_STDIO });
  const entry = { browser, profile };
  if (liveBrowsers.size === 0) for (const signal of EXIT_SIGNALS) process.on(signal, stopOnSignal);
  liveBrowsers.add(entry);
  try {
    let browserLog = "";
    browser.stderr.on("data", (chunk) => { browserLog = (browserLog + chunk).slice(-4000); });
    const session = await connect(browser, () => browserLog, BROWSER_START_MS);
    const result = await use(session);
    session.close();
    return result;
  } finally {
    browser.kill();
    liveBrowsers.delete(entry);
    if (liveBrowsers.size === 0) for (const signal of EXIT_SIGNALS) process.off(signal, stopOnSignal);
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`Could not remove ${profile}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

export function withRegressionBrowser(root, firstPage, use) {
  return withRegressionVite(root, firstPage, (base) => withBrowser((session) => use({ session, base })));
}

export function recordSnapshotOutcome(page, variant, outcome, snapshotTally, { ci = process.env.CI === "true", log = console.log } = {}) {
  if (outcome.late) {
    if (ci) {
      log(`✗ ${page}  snapshot settled late: ${outcome.label} (the page reported its result before its DOM stopped changing)`);
      return false;
    }
    log(`    snapshot settled late: ${outcome.label} (the page reported its result before its DOM stopped changing)`);
  }
  if (outcome.status in snapshotTally) {
    snapshotTally[outcome.status] += 1;
    if (outcome.status !== "same") log(`    snapshot ${outcome.status}: ${outcome.label}`);
    return true;
  }
  if (outcome.status === "missing") log(`✗ ${page}  no snapshot ${outcome.label}; run pnpm test:regression --update-snapshots`);
  else if (outcome.status === "unsettled") log(`✗ ${page}  ${variant} DOM is still changing after the page reported its result; ${outcome.label} not written (${outcome.diff.changes} changed lines between two captures)`);
  else log(`✗ ${page}  ${variant} DOM differs from ${outcome.label} (${outcome.diff.changes} changed lines; pnpm test:regression --update-snapshots if intended)`);
  if (outcome.diff) for (const line of outcome.diff.text.split("\n")) log(`    ${line}`);
  return false;
}

async function checkPage({ root, session, base, page, update, contrastAllowlist, snapshotTally }) {
  const lines = [];
  const log = (line) => lines.push(line);
  const started = Date.now();
  const { outcome, state, errors } = await runPage(session, base + page);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  log(`${outcome === "passed" ? "✓" : "✗"} ${page}  ${outcome}, ${passedChecks(state.text ?? "")} checks, ${seconds}s`);
  if (outcome !== "passed") {
    const shown = (state.text ?? "").split("\n").filter((line) => line.trim());
    for (const line of shown.filter((line) => !line.startsWith("PASS ")).slice(-5)) log(`    ${line}`);
    for (const error of errors.slice(0, 3)) log(`    ${error.split("\n")[0]}`);
    return { passed: false, lines };
  }
  let darkActual = null;
  const snapshot = async (variant) => {
    const result = await settledSnapshot({ root, page, variant, update, darkActual, capture: () => captureSnapshot(session), sleep });
    if (variant === "dark") darkActual = result.actual;
    return recordSnapshotOutcome(page, variant, result, snapshotTally, { log });
  };
  let passed = await snapshot("dark");
  const findings = await auditLight(session, page, contrastAllowlist);
  if (!SKIPPED_PAGES.includes(pageName(page))) passed = await snapshot("light") && passed;
  if (findings.length > 0) {
    passed = false;
    log(`✗ ${page}  light island: ${findings.length} text(s) under ${MIN_CONTRAST}:1`);
    for (const { key, ratio, text, color, background } of findings.slice(0, 8)) log(`    ${ratio} ${key} "${text}" ${color} on ${background}`);
  }
  return { passed, lines };
}

export function runnerOptions(args) {
  const words = [];
  let shard = null;
  let jobs = Number(process.env.REGRESSION_JOBS ?? 1);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--shard") {
      shard = parseShard(args[++i]);
      if (!shard) return { error: "--shard takes <index>/<count>, e.g. --shard 1/3." };
    } else if (arg === "--jobs") {
      jobs = parseJobs(args[++i]);
      if (!jobs) return { error: "--jobs takes a whole number of browsers, e.g. --jobs 2." };
    } else if (!arg.startsWith("--")) {
      words.push(arg);
    }
  }
  return { words, shard, jobs: parseJobs(jobs) ?? 1, update: args.includes("--update-snapshots") };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const options = runnerOptions(process.argv.slice(2));
  if (options.error) throw new Error(options.error);
  const { words, shard, update } = options;
  const matched = PAGES.filter((page) => words.length === 0 || words.some((word) => page.includes(word)));
  if (matched.length === 0) throw new Error(`No regression page matches ${words.join(", ")}.`);
  const timings = readTimings(root);
  const pages = shardOf(matched, shard, timings);
  if (pages.length === 0) {
    console.log(`Shard ${shard.index}/${shard.count} has no pages.`);
    return 0;
  }
  const jobs = Math.min(options.jobs, pages.length);
  if (shard || jobs > 1) console.log(`${shard ? `Shard ${shard.index}/${shard.count}: ` : ""}${pages.length} pages, ${jobs} browser${jobs > 1 ? "s" : ""}.`);
  let failed = 0;
  const contrastAllowlist = JSON.parse(readFileSync(path.join(root, "tests/regression/contrast-allowlist.json"), "utf8")).pages;
  const snapshotTally = { same: 0, created: 0, updated: 0, removed: 0 };
  const queue = jobs > 1 ? slowestFirst(pages, timings) : [...pages];
  await withRegressionVite(root, pages[0], (base) => Promise.all(Array.from({ length: jobs }, () => withBrowser(async (session) => {
    await prepareSnapshotBrowser(session);
    while (queue.length) {
      const result = await checkPage({ root, session, base, page: queue.shift(), update, contrastAllowlist, snapshotTally });
      if (!result.passed) failed += 1;
      console.log(result.lines.join("\n"));
    }
  }))));
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
