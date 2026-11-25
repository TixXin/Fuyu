import { randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { CLOSE, WINDOW_PROTOCOL } from "../protocol.mjs";

const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

function sameToken(given, token) {
  if (typeof given !== "string" || given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function failure(error) {
  return { code: error?.code ?? "failed", message: String(error?.message ?? error), ...(error?.data === undefined ? {} : { data: error.data }) };
}

export async function openWindowSocket({ origins, snapshot, onCall, helloWithinMs = 2000, host = "127.0.0.1" }) {
  const token = randomBytes(32).toString("hex");
  const pluginTokens = new Map();
  const tokensByPlugin = new Map();
  const allowed = new Set(origins);
  const server = new WebSocketServer({
    host,
    port: 0,
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: ({ origin }, accept) => (allowed.has(origin) ? accept(true) : accept(false, 403, "origin not allowed")),
  });
  await once(server, "listening");
  const clients = new Set();

  function resolvePluginToken(given) {
    if (typeof given !== "string") return null;
    for (const [candidate, plugin] of pluginTokens) {
      if (sameToken(given, candidate)) return plugin;
    }
    return null;
  }

  function snapshotFor(client) {
    return typeof snapshot === "function" ? snapshot({ window: client.window, plugin: client.plugin }) : snapshot;
  }

  server.on("connection", (socket) => {
    let client = null;
    const timer = setTimeout(() => socket.close(CLOSE.noHello, "no hello in time"), helloWithinMs);
    socket.on("close", () => {
      clearTimeout(timer);
      if (client) clients.delete(client);
    });
    socket.on("message", async (data, binary) => {
      if (binary) return socket.close(1003, "text only");
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return socket.close(1007, "not JSON");
      }
      if (!client) {
        if (message?.type !== "hello") return socket.close(CLOSE.noHello, "say hello first");
        const isMain = sameToken(message.token, token);
        const plugin = isMain ? undefined : resolvePluginToken(message.token);
        if (!isMain && !plugin) return socket.close(CLOSE.badToken, "wrong token");
        if (message.protocol !== WINDOW_PROTOCOL) return socket.close(CLOSE.badProtocol, `protocol ${WINDOW_PROTOCOL} only`);
        clearTimeout(timer);
        client = { socket, window: typeof message.window === "string" ? message.window : "", plugin, seq: 0 };
        clients.add(client);
        send(socket, { type: "welcome", protocol: WINDOW_PROTOCOL, seq: client.seq, snapshot: snapshotFor(client) });
        return;
      }
      if (message?.type === "snapshot") {
        send(socket, { type: "snapshot", seq: client.seq, snapshot: snapshotFor(client) });
      } else if (message?.type === "call") {
        try {
          const result = await onCall(message.method, message.params, client.window, client.plugin);
          send(socket, { type: "result", id: message.id, result: result ?? null });
        } catch (error) {
          send(socket, { type: "result", id: message.id, error: failure(error) });
        }
      }
    });
  });

  return {
    port: server.address().port,
    token,
    issuePluginToken(plugin) {
      if (typeof plugin !== "string" || !plugin) throw new TypeError("issuePluginToken requires a plugin id");
      const existing = tokensByPlugin.get(plugin);
      if (existing) return existing;
      const issued = randomBytes(32).toString("hex");
      tokensByPlugin.set(plugin, issued);
      pluginTokens.set(issued, plugin);
      return issued;
    },
    revokePluginToken(plugin) {
      const existing = tokensByPlugin.get(plugin);
      if (!existing) return false;
      tokensByPlugin.delete(plugin);
      pluginTokens.delete(existing);
      for (const client of [...clients]) {
        if (client.plugin === plugin) client.socket.close(CLOSE.badToken, "plugin token revoked");
      }
      return true;
    },
    publish(name, data, options = {}) {
      const privilegedOnly = options.privilegedOnly === true;
      const targetPlugin = typeof options.plugin === "string" ? options.plugin : null;
      for (const client of clients) {
        if (client.socket.readyState !== 1) continue;
        if (privilegedOnly && client.plugin !== undefined) continue;
        if (targetPlugin && client.plugin !== undefined && client.plugin !== targetPlugin) continue;
        client.seq += 1;
        client.socket.send(JSON.stringify({ type: "event", seq: client.seq, name, data }));
      }
    },
    windows: () => [...clients].filter((client) => client.plugin === undefined).map((client) => client.window),
    async close() {
      for (const client of clients) client.socket.close(CLOSE.stopping, "the host is stopping");
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
