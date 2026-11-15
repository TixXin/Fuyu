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
      const code = Number.isInteger(error?.code) || (error instanceof RpcError && typeof error.code === "string") ? error.code : -32000;
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
    if (message.method === "progress" && message.id === undefined && waiting.has(message.params?.id)) {
      waiting.get(message.params.id).onProgress?.(message.params.data ?? null);
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
    pending.unlisten?.();
    if (message.error) pending.reject(new RpcError(message.error.code, message.error.message, message.error.data));
    else pending.resolve(message.result);
  };

  const close = (reason) => {
    if (closed) return;
    closed = reason;
    for (const pending of waiting.values()) {
      clearTimeout(pending.timer);
      pending.unlisten?.();
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
    call(method, params, { timeoutMs = 10000, onProgress, signal } = {}) {
      if (closed) return Promise.reject(new RpcError(PEER_GONE, `the other side is gone: ${closed}`));
      if (signal?.aborted) return Promise.reject(signal.reason);
      const id = ++next;
      return new Promise((resolve, reject) => {
        const give = (error) => {
          if (!waiting.delete(id)) return;
          clearTimeout(pending.timer);
          pending.unlisten?.();
          send({ method: "cancel", params: { id } });
          reject(error);
        };
        const pending = { resolve, reject, onProgress: typeof onProgress === "function" ? onProgress : null };
        pending.timer = setTimeout(() => give(new RpcError("timeout", `${method} got no answer in ${timeoutMs} ms`, { method, timeoutMs })), timeoutMs);
        if (signal) {
          const abort = () => give(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
          pending.unlisten = () => signal.removeEventListener("abort", abort);
        }
        waiting.set(id, pending);
        send({ id, method, params });
      });
    },
    close,
    get closed() {
      return closed;
    },
  };
}
