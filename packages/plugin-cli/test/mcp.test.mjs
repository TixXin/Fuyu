import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { run } from "../src/cli.mjs";
import { TOOLS, defaultLocalApiConfigPath, handleMessage, localApiClient, runMcp } from "../src/app/mcp.mjs";

test("mcp lists read and write tools and handles initialize/ping", async () => {
  const init = await handleMessage({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, async () => null);
  assert.equal(init.result.serverInfo.name, "fuyu");
  assert.equal(init.result.protocolVersion, "2025-06-18");

  const ping = await handleMessage({ id: 2, method: "ping" }, async () => null);
  assert.deepEqual(ping.result, {});

  const listed = await handleMessage({ id: 3, method: "tools/list" }, async () => null);
  const names = listed.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, TOOLS.map((tool) => tool.name));
  for (const expected of ["clipboard_history", "todos_today", "todo_add", "todo_update", "todo_delete", "daily_note", "daily_note_set", "island_notify", "agent_status_report", "agent_status_clear"]) {
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }

  assert.equal(await handleMessage({ method: "notifications/initialized" }, async () => null), null);
  const missing = await handleMessage({ id: 4, method: "nope" }, async () => null);
  assert.equal(missing.error.code, -32601);
});

test("mcp routes every tool to the matching local API endpoint", async () => {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method ?? "GET", body: options.body });
    if (path.startsWith("/v1/clipboard")) {
      return {
        items: [
          { copiedAt: 1700000000000, favorite: false, truncated: false, text: "hello world" },
          { copiedAt: 1700000001000, favorite: true, truncated: false, text: "other entry" },
        ],
      };
    }
    return { ok: true, path };
  };

  const call = (name, args = {}) => handleMessage({ id: 1, method: "tools/call", params: { name, arguments: args } }, request);

  const clip = JSON.parse((await call("clipboard_history", { query: "HELLO", limit: 5 })).result.content[0].text);
  assert.equal(clip.length, 1);
  assert.equal(clip[0].text, "hello world");

  await call("todos_today");
  await call("todo_add", { title: "Ship MCP", date: "2026-11-26", project: "Fuyu" });
  await call("todo_update", { id: "t-1", completed: true, addFocusMinutes: 25 });
  await call("todo_delete", { id: "t-1" });
  await call("daily_note");
  await call("daily_note_set", { append: "done" });
  await call("island_notify", { source: "ci", title: "Build green", durationMs: 4000 });
  await call("agent_status_report", { source: "aider", phase: "running", title: "Refactor" });
  await call("agent_status_clear", { source: "aider" });

  assert.deepEqual(
    calls.map((c) => [c.method, c.path]),
    [
      ["GET", "/v1/clipboard?limit=50"],
      ["GET", "/v1/todos"],
      ["POST", "/v1/todos"],
      ["PATCH", "/v1/todos/t-1"],
      ["DELETE", "/v1/todos/t-1"],
      ["GET", "/v1/note"],
      ["PUT", "/v1/note"],
      ["POST", "/v1/notify"],
      ["PUT", "/v1/agent-status/aider"],
      ["DELETE", "/v1/agent-status/aider"],
    ],
  );
  assert.deepEqual(calls[2].body, { title: "Ship MCP", date: "2026-11-26", project: "Fuyu" });
  assert.deepEqual(calls[3].body, { completed: true, addFocusMinutes: 25 });
  assert.deepEqual(calls[6].body, { append: "done" });
  assert.deepEqual(calls[7].body, { source: "ci", title: "Build green", durationMs: 4000 });
  assert.deepEqual(calls[8].body, { phase: "running", title: "Refactor" });

  const invalid = await call("todo_add", { title: "   " });
  assert.equal(invalid.error.code, -32602);
  const unknown = await call("unknown_tool");
  assert.equal(unknown.error.code, -32602);
});

test("localApiClient reads token and port from local-api.json and runMcp processes stdio lines", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-mcp-"));
  try {
    const cfg = join(dir, "local-api.json");
    writeFileSync(cfg, JSON.stringify({ port: 39271, token: "abc123" }));
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url, init });
      return {
        status: 200,
        json: async () => ({ ok: true, data: { date: "2026-11-25", note: "hello" } }),
      };
    };

    const client = localApiClient(cfg, { fetchImpl });
    const data = await client("/v1/note");
    assert.deepEqual(data, { date: "2026-11-25", note: "hello" });
    assert.equal(seen[0].url, "http://127.0.0.1:39271/v1/note");
    assert.equal(seen[0].init.headers.Authorization, "Bearer abc123");

    const input = new PassThrough();
    const chunks = [];
    const output = new PassThrough();
    output.on("data", (chunk) => chunks.push(String(chunk)));
    input.write("not json\n");
    input.write(`${JSON.stringify({ id: 9, method: "tools/call", params: { name: "daily_note" } })}\n`);
    input.end();

    assert.equal(await runMcp({ config: cfg, input, output, fetchImpl }), 0);
    const lines = chunks.join("").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines[0].error.code, -32700);
    assert.equal(lines[1].id, 9);
    assert.match(lines[1].result.content[0].text, /"note": "hello"/);

    assert.equal(defaultLocalApiConfigPath({ env: { FUYU_HOME: dir }, home: dir, platform: "darwin" }), join(dir, "local-api.json"));

    const cliIn = new PassThrough();
    cliIn.end(`${JSON.stringify({ id: 1, method: "ping" })}\n`);
    let cliOut = "";
    const rc = await run(["mcp", "--config", cfg], {
      stdin: cliIn,
      stdout: { write: (text) => { cliOut += text; } },
      stderr: { write: () => {} },
      cwd: dir,
      env: {},
    });
    assert.equal(rc, 0);
    assert.deepEqual(JSON.parse(cliOut.trim()), { jsonrpc: "2.0", id: 1, result: {} });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
