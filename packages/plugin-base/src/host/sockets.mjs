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
  const allowed = new Set(origins);
  const server = new WebSocketServer({
    host,
    port: 0,
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: ({ origin }, accept) => (allowed.has(origin) ? accept(true) : accept(false, 403, "origin not allowed")),
  });
  await once(server, "listening");
  const clients = new Set();
  let seq = 0;

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
        if (!sameToken(message.token, token)) return socket.close(CLOSE.badToken, "wrong token");
        if (message.protocol !== WINDOW_PROTOCOL) return socket.close(CLOSE.badProtocol, `protocol ${WINDOW_PROTOCOL} only`);
        clearTimeout(timer);
        client = { socket, window: typeof message.window === "string" ? message.window : "" };
        clients.add(client);
        send(socket, { type: "welcome", protocol: WINDOW_PROTOCOL, seq, snapshot: snapshot() });
        return;
      }
      if (message?.type === "snapshot") {
        send(socket, { type: "snapshot", seq, snapshot: snapshot() });
      } else if (message?.type === "call") {
        try {
          const result = await onCall(message.method, message.params, client.window);
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
    publish(name, data) {
      seq += 1;
      const text = JSON.stringify({ type: "event", seq, name, data });
      for (const client of clients) if (client.socket.readyState === 1) client.socket.send(text);
    },
    windows: () => [...clients].map((client) => client.window),
    async close() {
      for (const client of clients) client.socket.close(CLOSE.stopping, "the host is stopping");
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
