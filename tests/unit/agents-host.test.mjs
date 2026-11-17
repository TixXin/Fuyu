import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { agentsV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { focusParams, fromRust, reportEntry, sessionEntry, usageReport } from "../../src/features/agent-status/host/index.mjs";
import { agentFeedOf } from "../../src/features/agent-status/plugin/agentFeed.ts";
import { activityOf } from "../../src/features/center-pattern/centerSettings.ts";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const seen = [];
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    seen.push(message);
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

async function open(methods) {
  const dir = mkdtempSync(join(tmpdir(), "agents-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let agents;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (agents = ctx.services.get(agentsV1)) });
  return { host, rust, agents };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}

const ENTRY = { key: "claudeCode:a1", provider: "claudeCode", sessionId: "a1", title: "Fix the build", cwd: "/work", phase: "running", light: "working", updatedAt: 5, remoteHost: null, listed: true, unseen: false };

test("the agents plugin provides agents/v1 through Rust", async () => {
  const { host, rust, agents } = await open({
    "agents.sessions": () => ({ sessions: [ENTRY], others: [] }),
    "agents.usage": () => ({ claude: null, codex: null }),
    "agents.focus": ({ provider }) => ({ found: provider === "claudeCode" }),
    "agents.remoteHosts": () => ({ hosts: [] }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "agents").state, "running");
  assert.deepEqual(await agents.sessions(), { sessions: [ENTRY], others: [] });
  assert.deepEqual(await agents.usage(), { claude: null, codex: null });
  assert.deepEqual(await agents.focus({ provider: "claudeCode", sessionId: "a1" }), { found: true });
  assert.deepEqual(rust.asked("agents.focus"), [{ provider: "claudeCode", sessionId: "a1", cwd: null, title: null }]);
  await assert.rejects(agents.focus({}), { code: "bad-params" });
  await assert.rejects(agents.focus({ provider: "codex", window: 1 }), { code: "bad-params" });
  assert.equal(rust.asked("agents.focus").length, 1);
  assert.deepEqual(await agents.remoteHosts(), { hosts: [] });
});

test("switched-off agents are peer-gone, and a stopped agents plugin is not-ready", async () => {
  const { host, agents } = await open({
    "agents.sessions": () => {
      throw Object.assign(new Error("The agents plugin is switched off."), { code: "inactive" });
    },
  });
  await assert.rejects(agents.sessions(), (error) => error.code === "peer-gone" && error.data.reason === "inactive");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "agents").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "agents/v1")));
  await assert.rejects(agents.sessions(), { code: "not-ready" });
});

test("the island's sessions and usage turn into the shape Rust answers with", () => {
  const session = { provider: "claudeCode", sessionId: "a1", cwd: "/work", title: "Fix the build", model: "opus", phase: "running", lastMessage: null, updatedAt: 5, host: null, turnStartedAt: 1 };
  assert.deepEqual(sessionEntry(session, { listed: true, unseen: false, light: "working" }), ENTRY);
  assert.equal(sessionEntry(session, { listed: true, unseen: false }).light, "done");
  const done = { ...session, sessionId: "b2", phase: "completed", remoteHost: "box", replyAsks: true };
  const feed = agentFeedOf([session, done], [session], new Set(["claudeCode:b2"]), [{ id: "x", name: "X", phase: "running", updatedAt: 9, title: "t" }]);
  assert.deepEqual(feed.sessions.map(({ key, light, listed, unseen, remoteHost }) => ({ key, light, listed, unseen, remoteHost })), [
    { key: "claudeCode:a1", light: "working", listed: true, unseen: false, remoteHost: null },
    { key: "claudeCode:b2", light: "yourTurn", listed: false, unseen: true, remoteHost: "box" },
  ]);
  assert.deepEqual(feed.others, [{ id: "x", name: "X", phase: "running", updatedAt: 9 }]);
  assert.deepEqual(reportEntry(null), { id: "", name: "", phase: "idle", updatedAt: 0 });
  assert.deepEqual(activityOf(feed), [{ phase: "running", updatedAt: 5 }, { phase: "completed", updatedAt: 5 }, { phase: "running", updatedAt: 9 }]);
  const usage = { updatedAt: 3, fiveHour: { name: "5h", used: 40, resetsAt: null }, sevenDay: null, models: [{ name: "opus", used: 10, resetsAt: 7 }], plan: "max", source: "api", error: { kind: "tokenExpired", message: "log in again" } };
  assert.deepEqual(usageReport(usage), { updatedAt: 3, fiveHour: { name: "5h", used: 40, resetsAt: null }, sevenDay: null, models: [{ name: "opus", used: 10, resetsAt: 7 }], plan: "max", source: "api", error: "tokenExpired" });
  assert.equal(usageReport(null), null);
  assert.deepEqual(focusParams({ provider: "codex", cwd: "" }), { provider: "codex", sessionId: null, cwd: null, title: null });
  assert.equal(fromRust({ code: "inactive", message: "off" }).code, "peer-gone");
  assert.equal(fromRust("plain").data.reason, "failed");
});

test("plugins can register external agent sources for sessions, focus and usage, and stopping withdraws them", async () => {
  const { host, rust, agents } = await open({
    "agents.sessions": () => ({ sessions: [ENTRY], others: [] }),
    "agents.usage": () => ({ claude: null, codex: null }),
    "agents.focus": () => ({ found: false }),
    "agents.remoteHosts": () => ({ hosts: [] }),
  });
  let changed = 0;
  const offChanged = agents.on("changed", () => {
    changed += 1;
  });
  const focusedArgs = [];
  const aiderPlugin = await host.ctx.plugin({
    name: "aider-harness",
    inject: ["agents.sources"],
    apply(ctx) {
      ctx.agentSources.register({
        provider: "aider",
        sessions: () => [
          {
            sessionId: "s-aider",
            title: "Refactor API",
            cwd: "/repo",
            phase: "running",
            light: "working",
            updatedAt: 42,
          },
        ],
        others: () => [{ id: "aider-bg", name: "Aider Daemon", phase: "running", updatedAt: 40 }],
        focus: (params) => {
          focusedArgs.push(params);
          return { found: true };
        },
        usage: () => ({
          updatedAt: 50,
          fiveHour: { name: "5h", used: 25, resetsAt: 100 },
          sevenDay: null,
          models: [],
          plan: "pro",
          source: "plugin",
        }),
      });
      assert.throws(
        () => ctx.agentSources.register({ provider: "aider" }),
        { code: "conflict" },
      );
    },
  });
  assert.ok(await until(() => changed >= 1));
  const sessions = await agents.sessions();
  assert.equal(sessions.sessions.length, 2);
  assert.deepEqual(sessions.sessions[1], {
    key: "aider:s-aider",
    provider: "aider",
    sessionId: "s-aider",
    title: "Refactor API",
    cwd: "/repo",
    phase: "running",
    light: "working",
    updatedAt: 42,
    remoteHost: null,
    listed: true,
    unseen: false,
  });
  assert.deepEqual(sessions.others, [{ id: "aider-bg", name: "Aider Daemon", phase: "running", updatedAt: 40 }]);
  assert.deepEqual(await agents.focus({ provider: "aider", sessionId: "s-aider", cwd: "/repo" }), { found: true });
  assert.equal(focusedArgs.length, 1);
  assert.equal(rust.asked("agents.focus").length, 0);
  const usage = await agents.usage();
  assert.equal(usage.extra?.aider?.plan, "pro");
  assert.equal(usage.extra?.aider?.fiveHour?.used, 25);

  await aiderPlugin.dispose();
  assert.ok(await until(() => changed >= 2));
  assert.deepEqual(await agents.sessions(), { sessions: [ENTRY], others: [] });
  assert.deepEqual(await agents.usage(), { claude: null, codex: null });
  await offChanged();
});
