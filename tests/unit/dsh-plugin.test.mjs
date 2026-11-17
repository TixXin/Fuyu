import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_PATH = join(ROOT, "src-tauri/src/agent_status/hooks/fuyu-dsh-plugin.js");

function createMockCordisContext() {
  const listeners = new Map();
  let approvalHandler = null;
  let approvalOptions = null;
  const disposers = [];

  const ctx = {
    on(event, fn) {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    },
    inject(deps, callback) {
      if (Array.isArray(deps) && deps.includes("approval")) {
        callback({
          on(event, fn, options) {
            if (event === "approval/request") {
              approvalHandler = fn;
              approvalOptions = options;
            }
          },
        });
      }
    },
    effect(setup) {
      const cleanup = setup();
      if (typeof cleanup === "function") disposers.push(cleanup);
    },
  };

  return {
    ctx,
    emit(event, ...args) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },
    get approvalHandler() {
      return approvalHandler;
    },
    get approvalOptions() {
      return approvalOptions;
    },
    dispose() {
      for (const fn of disposers.splice(0)) fn();
    },
  };
}

async function loadGeneratedPlugin(fuyuDir) {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const code = template.replace("\"__FUYU_DIR__\"", JSON.stringify(fuyuDir));
  const pluginPath = join(fuyuDir, `plugin-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  await writeFile(pluginPath, code, "utf8");
  return import(pathToFileURL(pluginPath).href);
}

test("fuyu-dsh-plugin handles allow, deny, hand-back, cancellation, and status files", async () => {
  const fuyuDir = await mkdtemp(join(tmpdir(), "fuyu-dsh-plugin-test-"));
  const requests = [];
  let responder = (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  };

  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({
        url: req.url,
        auth: req.headers.authorization,
        body: JSON.parse(body),
      });
      responder(req, res);
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await writeFile(join(fuyuDir, "agent-approval.json"), JSON.stringify({ port, token: "secret-token" }), "utf8");

  try {
    const plugin = await loadGeneratedPlugin(fuyuDir);
    const harness = createMockCordisContext();
    plugin.apply(harness.ctx);
    assert.equal(harness.approvalOptions?.prepend, true);
    assert.equal(typeof harness.approvalHandler, "function");

    const session = { id: "session-123", header: { id: "session-123", cwd: "/work/demo" } };
    harness.emit("session/event", session, { type: "turn/start" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await stat(join(fuyuDir, "agent-dsh-running.flag"));

    harness.emit("session/event", session, {
      type: "tool/call",
      data: { callId: "call-1", name: "shell", arguments: JSON.stringify({ command: "pnpm test" }) },
    });

    responder = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ outcome: "allowed-once" }));
    };
    let delegated = 0;
    const allowResult = await harness.approvalHandler(
      {
        agent: { session },
        toolName: "shell",
        callId: "call-1",
        reason: "Needs network access",
      },
      async () => {
        delegated += 1;
        return "unavailable";
      },
    );
    assert.equal(allowResult, "allowed-once");
    assert.equal(delegated, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/dsh/permission");
    assert.equal(requests[0].auth, "Bearer secret-token");
    assert.deepEqual(requests[0].body, {
      session_id: "session-123",
      cwd: "/work/demo",
      tool_name: "shell",
      tool_input: { command: "pnpm test", description: "Needs network access" },
    });

    responder = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ outcome: "rejected", reason: "Denied in Fuyu" }));
    };
    const denyResult = await harness.approvalHandler(
      { agent: { session }, toolName: "write_file", reason: "Modify config" },
      async () => "unavailable",
    );
    assert.equal(denyResult, "rejected");

    responder = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    };
    const handBackResult = await harness.approvalHandler(
      { agent: { session }, toolName: "shell", reason: "ls -la" },
      async () => {
        delegated += 1;
        return "allowed-once";
      },
    );
    assert.equal(handBackResult, "allowed-once");
    assert.equal(delegated, 1);

    let socketClosed = false;
    let notifyClosed;
    const closedPromise = new Promise((resolve) => {
      notifyClosed = resolve;
    });
    responder = (req, res) => {
      req.socket.on("close", () => {
        socketClosed = true;
        notifyClosed();
      });
      res.flushHeaders();
    };
    const abortController = new AbortController();
    const pendingCancel = harness.approvalHandler(
      { agent: { session }, toolName: "shell", callId: "call-cancel", signal: abortController.signal },
      async () => {
        delegated += 1;
        return "unavailable";
      },
    );
    setTimeout(() => abortController.abort(), 40);
    const cancelledResult = await pendingCancel;
    await closedPromise;
    assert.equal(cancelledResult, "cancelled");
    assert.equal(socketClosed, true);
    assert.equal(delegated, 1);

    harness.emit("session/event", session, { type: "turn/end", data: { reason: { kind: "error" } } });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const statusJson = JSON.parse(await readFile(join(fuyuDir, "agent-status.json"), "utf8"));
    assert.equal(statusJson.dsh.phase, "failed");

    harness.dispose();
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(fuyuDir, { recursive: true, force: true });
  }
});
