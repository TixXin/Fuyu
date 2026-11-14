import { createInterface } from "node:readline";

export const PEER_GONE = "peer-gone";

export class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

export function connect({ input, write, onClose }) {
  const handlers = new Map();
  const waiting = new Map();
  let next = 0;
  let closed = null;

  const send = (message) => {
    if (!closed) write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  };

  const reply = async (message) => {
    const handler = handlers.get(message.method);
    if (!handler) {
      if (message.id !== undefined) send({ id: message.id, error: { code: -32601, message: `no method ${message.method}` } });
      return;
    }
    try {
      const result = await handler(message.params);
      if (message.id !== undefined) send({ id: message.id, result: result ?? null });
    } catch (error) {
      if (message.id === undefined) return;
      const code = Number.isInteger(error?.code) ? error.code : -32000;
      send({ id: message.id, error: { code, message: String(error?.message ?? error), ...(error?.data === undefined ? {} : { data: error.data }) } });
    }
  };

  const receive = (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ id: null, error: { code: -32700, message: "the line is not JSON" } });
      return;
    }
    if (typeof message.method === "string") {
      void reply(message);
      return;
    }
    const pending = waiting.get(message.id);
    if (!pending) return;
    waiting.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new RpcError(message.error.code, message.error.message, message.error.data));
    else pending.resolve(message.result);
  };

  const close = (reason) => {
    if (closed) return;
    closed = reason;
    for (const pending of waiting.values()) {
      clearTimeout(pending.timer);
      pending.reject(new RpcError(PEER_GONE, `the other side is gone: ${reason}`));
    }
    waiting.clear();
    onClose?.(reason);
  };

  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on("line", receive);
  lines.on("close", () => close("its end of the pipe closed"));

  return {
    handle(method, handler) {
      handlers.set(method, handler);
    },
    notify(method, params) {
      send({ method, params });
    },
    call(method, params, { timeoutMs = 10000 } = {}) {
      if (closed) return Promise.reject(new RpcError(PEER_GONE, `the other side is gone: ${closed}`));
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new RpcError("timeout", `${method} got no answer in ${timeoutMs} ms`));
        }, timeoutMs);
        waiting.set(id, { resolve, reject, timer });
        send({ id, method, params });
      });
    },
    close,
    get closed() {
      return closed;
    },
  };
}
