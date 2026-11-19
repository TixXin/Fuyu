import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BuildError } from "../errors.mjs";

export const BROWSER_ENV = "CHROME_PATH";
const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];
const START_MS = 60_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function findBrowser(env = process.env) {
  const found = env[BROWSER_ENV] || CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) throw new BuildError(`no Chrome, Edge or Chromium found; install one or set ${BROWSER_ENV} to its program file`);
  if (!existsSync(found)) throw new BuildError(`${BROWSER_ENV} points to ${found}, which does not exist`);
  return found;
}

function openPipe(child, log) {
  const [, , , toBrowser, fromBrowser] = child.stdio;
  const pending = new Map();
  const listeners = new Set();
  let id = 0;
  let buffer = "";
  let closed = null;
  const fail = (why) => {
    if (closed) return;
    closed = `${why}${log().trim() ? `\n${log().trim()}` : ""}`;
    for (const { reject } of pending.values()) reject(new BuildError(closed));
    pending.clear();
  };
  fromBrowser.setEncoding("utf8");
  fromBrowser.on("data", (chunk) => {
    const parts = (buffer + chunk).split("\0");
    buffer = parts.pop();
    for (const frame of parts) {
      const message = JSON.parse(frame);
      const waiting = message.id ? pending.get(message.id) : null;
      if (waiting) {
        pending.delete(message.id);
        if (message.error) waiting.reject(new BuildError(`the browser refused ${waiting.method}: ${message.error.message}`));
        else waiting.resolve(message.result ?? {});
      }
      for (const listener of listeners) listener(message);
    }
  });
  fromBrowser.on("close", () => fail("the browser closed its DevTools pipe"));
  fromBrowser.on("error", () => fail("the browser's DevTools pipe failed"));
  toBrowser.on("error", () => fail("the browser's DevTools pipe failed"));
  child.on("exit", (code, signal) => fail(`the browser exited (${signal ?? `code ${code}`})`));
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      if (closed) return reject(new BuildError(closed));
      const next = ++id;
      pending.set(next, { resolve, reject, method });
      toBrowser.write(`${JSON.stringify({ id: next, method, params, sessionId })}\0`);
    });
  return { send, listeners, fail, close: () => toBrowser.end() };
}

export async function withBrowser(use, { env = process.env, width = 1280, height = 900, scale = 2 } = {}) {
  const program = findBrowser(env);
  const profile = mkdtempSync(join(tmpdir(), "fuyu-plugin-shots-"));
  const child = spawn(
    program,
    ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-color-profile=srgb", "--remote-debugging-pipe", `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "about:blank"],
    { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] },
  );
  let log = "";
  child.stderr.on("data", (chunk) => {
    log = (log + chunk).slice(-2000);
  });
  const pipe = openPipe(child, () => log);
  const timer = setTimeout(() => pipe.fail(`the browser did not open a page within ${START_MS / 1000}s`), START_MS);
  try {
    let target;
    while (!target) {
      const { targetInfos = [] } = await pipe.send("Target.getTargets");
      target = targetInfos.find((info) => info.type === "page");
      if (!target) await sleep(100);
    }
    const { sessionId } = await pipe.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    clearTimeout(timer);
    const errors = [];
    pipe.listeners.add((message) => {
      if (message.sessionId !== sessionId || message.method !== "Runtime.exceptionThrown") return;
      const details = message.params.exceptionDetails;
      errors.push(String(details.exception?.description ?? details.text).split("\n")[0]);
    });
    const send = (method, params) => pipe.send(method, params, sessionId);
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    const page = {
      errors,
      async open(url) {
        errors.length = 0;
        await send("Page.navigate", { url });
      },
      async evaluate(expression) {
        const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (exceptionDetails) throw new BuildError(`the page failed: ${String(exceptionDetails.exception?.description ?? exceptionDetails.text).split("\n")[0]}`);
        return result?.value;
      },
      async until(expression, what, timeoutMs = 20_000) {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          const value = await page.evaluate(expression);
          if (value) return value;
          if (Date.now() > deadline) throw new BuildError(`timed out waiting for ${what}${errors.length ? `: ${errors[0]}` : ""}`);
          await sleep(50);
        }
      },
      async capture(clip) {
        const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
        return Buffer.from(data, "base64");
      },
    };
    return await use(page);
  } finally {
    clearTimeout(timer);
    pipe.close();
    child.kill();
    await sleep(200);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {}
  }
}
