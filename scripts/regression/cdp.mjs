export const PIPE_STDIO = ["ignore", "ignore", "pipe", "pipe", "pipe"];

export function splitFrames(buffer) {
  const parts = buffer.split("\0");
  return { frames: parts.slice(0, -1), rest: parts[parts.length - 1] };
}

function openPipe(browser, browserLog) {
  const [, , , toBrowser, fromBrowser] = browser.stdio;
  let id = 0;
  let buffer = "";
  let closed = null;
  const pending = new Map();
  const listeners = new Set();
  const fail = (why) => {
    if (closed) return;
    closed = `${why} Browser output:\n${browserLog().trim() || "(none)"}`;
    for (const { reject } of pending.values()) reject(new Error(closed));
    pending.clear();
  };
  fromBrowser.setEncoding("utf8");
  fromBrowser.on("data", (chunk) => {
    const { frames, rest } = splitFrames(buffer + chunk);
    buffer = rest;
    for (const frame of frames) {
      const message = JSON.parse(frame);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id).resolve(message.result ?? {});
        pending.delete(message.id);
      }
      for (const listener of listeners) listener(message);
    }
  });
  fromBrowser.on("close", () => fail("The browser closed its DevTools pipe."));
  fromBrowser.on("error", () => fail("The browser's DevTools pipe failed."));
  toBrowser.on("error", () => fail("The browser's DevTools pipe failed."));
  browser.on("exit", (code, signal) => fail(`The browser exited (${signal ?? `code ${code}`}).`));
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (closed) { reject(new Error(closed)); return; }
    const next = ++id;
    pending.set(next, { resolve, reject });
    toBrowser.write(`${JSON.stringify({ id: next, method, params, sessionId })}\0`);
  });
  return { send, listeners, fail, close: () => toBrowser.end() };
}

export async function connect(browser, browserLog, startMs) {
  const pipe = openPipe(browser, browserLog);
  const timer = setTimeout(() => pipe.fail(`The browser did not start: no page within ${startMs / 1000}s.`), startMs);
  let sessionId;
  try {
    let page;
    while (!page) {
      const { targetInfos = [] } = await pipe.send("Target.getTargets");
      page = targetInfos.find((target) => target.type === "page");
      if (!page) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    ({ sessionId } = await pipe.send("Target.attachToTarget", { targetId: page.targetId, flatten: true }));
  } finally {
    clearTimeout(timer);
  }
  const errors = [];
  pipe.listeners.add((message) => {
    if (message.sessionId !== sessionId || message.method !== "Runtime.exceptionThrown") return;
    errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => pipe.send(method, params, sessionId);
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: process.env.REGRESSION_REDUCED_MOTION ?? "no-preference" }],
  });
  return { send, errors, close: pipe.close };
}
