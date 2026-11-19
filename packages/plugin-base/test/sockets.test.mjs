import assert from "node:assert/strict";
import { after, test } from "node:test";
import WebSocket from "ws";
import { connectHost, createServiceProxy } from "@fuyu/plugin-base/client";
import { openWindowSocket } from "@fuyu/plugin-base/host";
import { CLOSE } from "@fuyu/plugin-base/protocol";
import { defineService } from "@fuyu/plugin-base/services";
import { until } from "./workspace.mjs";

const ORIGIN = "tauri://localhost";
const open = (url) => new WebSocket(url, { origin: ORIGIN });
const servers = [];
after(async () => {
  for (const server of servers) await server.close();
});

async function serve(snapshot = () => ({ plugins: [] }), onCall = (method) => ({ method })) {
  const server = await openWindowSocket({ origins: [ORIGIN, "http://tauri.localhost"], snapshot, onCall, helloWithinMs: 300 });
  servers.push(server);
  return server;
}

function raw(server, origin = ORIGIN) {
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/`, { origin });
  const closed = new Promise((resolve) => socket.on("close", (code) => resolve(code)));
  const errored = new Promise((resolve) => socket.on("error", (error) => resolve(error)));
  const opened = new Promise((resolve) => socket.on("open", resolve));
  return { socket, closed, errored, opened };
}

test("a window with the token gets a snapshot, its calls answered and the events in order", async () => {
  let plugins = [{ id: "a", state: "running" }];
  const server = await serve(() => ({ plugins }), (method, params, window) => ({ method, params, window }));
  const snapshots = [];
  const events = [];
  const connection = connectHost({
    resolve: async () => ({ port: server.port, token: server.token }),
    window: "main",
    open,
    onSnapshot: (snapshot, info) => snapshots.push({ snapshot, info }),
    onEvent: (name, data) => events.push([name, data]),
  });
  assert.ok(await until(() => connection.state === "open"));
  assert.deepEqual(snapshots[0], { snapshot: { plugins }, info: { seq: 0, fresh: true } });
  assert.deepEqual(await connection.call("status", { x: 1 }), { method: "status", params: { x: 1 }, window: "main" });
  assert.deepEqual(server.windows(), ["main"]);
  for (let index = 1; index <= 50; index += 1) server.publish("tick", index);
  assert.ok(await until(() => events.length === 50));
  assert.deepEqual(events.map(([, data]) => data), Array.from({ length: 50 }, (_, index) => index + 1));
  connection.close();
});

test("a thrown error in a call comes back with its code", async () => {
  const server = await serve(undefined, () => {
    throw Object.assign(new Error("not here"), { code: "no-method" });
  });
  const connection = connectHost({ resolve: async () => ({ port: server.port, token: server.token }), window: "main", open });
  assert.ok(await until(() => connection.state === "open"));
  await assert.rejects(connection.call("missing"), (error) => error.code === "no-method" && error.message === "not here");
  connection.close();
});

test("an unknown origin is refused before the socket opens", async () => {
  const server = await serve();
  const { errored } = raw(server, "http://evil.example");
  assert.match(String((await errored).message), /403/);
});

test("a wrong token, a missing hello and a wrong protocol are each closed with their own code", async () => {
  const server = await serve();
  const wrong = raw(server);
  await wrong.opened;
  wrong.socket.send(JSON.stringify({ type: "hello", token: "0".repeat(64), protocol: 1, window: "main" }));
  assert.equal(await wrong.closed, CLOSE.badToken);
  const silent = raw(server);
  assert.equal(await silent.closed, CLOSE.noHello);
  const old = raw(server);
  await old.opened;
  old.socket.send(JSON.stringify({ type: "hello", token: server.token, protocol: 99, window: "main" }));
  assert.equal(await old.closed, CLOSE.badProtocol);
  assert.deepEqual(server.windows(), []);
});

test("when the host restarts on a new port and token, the window reconnects and gets a fresh snapshot", async () => {
  const first = await serve(() => ({ generation: 1 }), () => new Promise(() => {}));
  let target = { port: first.port, token: first.token };
  const snapshots = [];
  const states = [];
  const connection = connectHost({
    resolve: async () => target,
    window: "island",
    open,
    retryMs: [0, 20, 50],
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onState: (state) => states.push(state),
  });
  assert.ok(await until(() => connection.state === "open"));
  const waiting = connection.call("slow", null, { timeoutMs: 60000 });
  const second = await serve(() => ({ generation: 2 }));
  target = { port: second.port, token: second.token };
  const started = Date.now();
  await first.close();
  await assert.rejects(waiting, (error) => error.code === "peer-gone");
  assert.ok(Date.now() - started < 1000, "the waiting call failed at once");
  assert.ok(await until(() => snapshots.length === 2));
  assert.deepEqual(snapshots, [{ generation: 1 }, { generation: 2 }]);
  assert.ok(states.includes("reconnecting"));
  assert.equal(connection.state, "open");
  connection.close();
});

test("a window that misses an event asks for a snapshot instead of going on with a gap", async () => {
  const listeners = {};
  const sent = [];
  const fake = {
    send: (text) => sent.push(JSON.parse(text)),
    close() {},
    addEventListener: (type, listener) => (listeners[type] = listener),
  };
  const snapshots = [];
  const events = [];
  connectHost({
    resolve: async () => ({ port: 1, token: "t" }),
    window: "main",
    open: () => fake,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onEvent: (name, data) => events.push(data),
  });
  await until(() => listeners.open);
  listeners.open();
  const deliver = (message) => listeners.message({ data: JSON.stringify(message) });
  deliver({ type: "welcome", protocol: 1, seq: 5, snapshot: "s5" });
  deliver({ type: "event", seq: 6, name: "e", data: 6 });
  deliver({ type: "event", seq: 8, name: "e", data: 8 });
  assert.deepEqual(events, [6]);
  assert.deepEqual(sent.at(-1), { type: "snapshot" });
  deliver({ type: "snapshot", seq: 8, snapshot: "s8" });
  deliver({ type: "event", seq: 9, name: "e", data: 9 });
  assert.deepEqual(snapshots, ["s5", "s8"]);
  assert.deepEqual(events, [6, 9]);
});

test("service events a window asked for before it connected, or before the host restarted, are asked for again from the snapshot handler", async () => {
  const asked = [];
  const record = (host) => (method, params) => {
    asked.push([host, method, params]);
    return null;
  };
  const first = await serve(() => ({}), record("first"));
  let target = { port: first.port, token: first.token };
  let connection = null;
  const proxy = createServiceProxy((method, params, options) => connection?.call(method, params, options) ?? Promise.reject(new Error("not connected yet")));
  const notes = proxy.get(defineService("notes/v1", { methods: { list: true }, events: { added: true } }));
  notes.on("added", () => {});
  connection = connectHost({
    resolve: async () => target,
    window: "main",
    open,
    retryMs: [0, 20, 50],
    onSnapshot: (snapshot, { fresh }) => {
      if (fresh) void proxy.resubscribe();
    },
  });
  try {
    const wanted = { service: "notes/v1", event: "added" };
    assert.ok(await until(() => asked.length === 1), "the first host was asked for the event");
    assert.deepEqual(asked, [["first", "service.on", wanted]]);
    const second = await serve(() => ({}), record("second"));
    target = { port: second.port, token: second.token };
    await first.close();
    assert.ok(await until(() => asked.length === 2), "the restarted host was asked for the event again");
    assert.deepEqual(asked[1], ["second", "service.on", wanted]);
  } finally {
    connection.close();
  }
});
