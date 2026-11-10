import assert from "node:assert/strict";
import test from "node:test";
import { handleMessage, TOOLS } from "../src/mcp.mjs";

const call = (name, args = {}) => ({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });

test("the MCP server introduces itself and lists its read-only tools", async () => {
  const init = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, async () => ({}));
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, async () => ({})), null);
  const list = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, async () => ({}));
  assert.deepEqual(list.result.tools.map((tool) => tool.name), TOOLS.map((tool) => tool.name));
  const unknown = await handleMessage({ jsonrpc: "2.0", id: 3, method: "resources/list" }, async () => ({}));
  assert.equal(unknown.error.code, -32601);
});

test("clipboard_history reads the local API and filters by text", async () => {
  const asked = [];
  const get = async (path) => {
    asked.push(path);
    return { items: [{ id: "a", text: "Meeting at 3", copiedAt: 0, favorite: false, truncated: false }, { id: "b", text: "lunch", copiedAt: 0, favorite: true, truncated: false }] };
  };
  const answer = await handleMessage(call("clipboard_history", { query: "meeting", limit: 5 }), get);
  assert.deepEqual(asked, ["/v1/clipboard?limit=50"]);
  const items = JSON.parse(answer.result.content[0].text);
  assert.deepEqual(items.map((item) => item.text), ["Meeting at 3"]);
});

test("a refusal from the island comes back as a tool error, not a crash", async () => {
  const answer = await handleMessage(call("clipboard_history"), async () => {
    throw new Error("Reading the clipboard history is off in Fuyu settings");
  });
  assert.equal(answer.result.isError, true);
  assert.match(answer.result.content[0].text, /off in Fuyu settings/);
});
