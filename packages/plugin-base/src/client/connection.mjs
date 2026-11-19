import { CLOSE, WINDOW_PROTOCOL } from "../protocol.mjs";

const RETRY_MS = [0, 100, 250, 500, 1000, 2000];
const FATAL = new Set([CLOSE.badProtocol]);

export class HostCallError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = "HostCallError";
    this.code = code;
    this.data = data;
  }
}

export function connectHost({ resolve, window, onSnapshot, onEvent, onState, open = (url) => new WebSocket(url), retryMs = RETRY_MS, callTimeoutMs = 10000 }) {
  let socket = null;
  let state = "connecting";
  let seq = 0;
  let attempt = 0;
  let next = 0;
  let stopped = false;
  let retryTimer = null;
  const waiting = new Map();

  const setState = (value, detail) => {
    state = value;
    onState?.(value, detail);
  };

  const failWaiting = (reason) => {
    for (const pending of waiting.values()) {
      clearTimeout(pending.timer);
      pending.reject(new HostCallError("peer-gone", `the plugin host is gone: ${reason}`));
    }
    waiting.clear();
  };

  const schedule = (reason) => {
    if (stopped) return;
    setState("reconnecting", reason);
    const delay = retryMs[Math.min(attempt, retryMs.length - 1)];
    attempt += 1;
    retryTimer = setTimeout(dial, delay);
  };

  const receive = (message) => {
    if (message.type === "welcome" || message.type === "snapshot") {
      seq = message.seq;
      attempt = 0;
      const fresh = message.type === "welcome";
      if (fresh) state = "open";
      onSnapshot?.(message.snapshot, { seq, fresh });
      if (fresh) onState?.("open");
    } else if (message.type === "event") {
      if (message.seq !== seq + 1) {
        socket.send(JSON.stringify({ type: "snapshot" }));
        return;
      }
      seq = message.seq;
      onEvent?.(message.name, message.data);
    } else if (message.type === "result") {
      const pending = waiting.get(message.id);
      if (!pending) return;
      waiting.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new HostCallError(message.error.code, message.error.message, message.error.data));
      else pending.resolve(message.result);
    }
  };

  async function dial() {
    if (stopped) return;
    setState("connecting");
    let target;
    try {
      target = await resolve();
    } catch (error) {
      return schedule(`could not find the host: ${error?.message ?? error}`);
    }
    if (stopped) return;
    if (!target) return schedule("the host is not running");
    let current;
    try {
      current = open(`ws://127.0.0.1:${target.port}/`);
    } catch (error) {
      return schedule(String(error?.message ?? error));
    }
    socket = current;
    current.addEventListener("open", () => {
      current.send(JSON.stringify({ type: "hello", token: target.token, protocol: WINDOW_PROTOCOL, window }));
    });
    current.addEventListener("message", (event) => {
      if (socket !== current) return;
      try {
        receive(JSON.parse(String(event.data)));
      } catch {
        current.close();
      }
    });
    current.addEventListener("close", (event) => {
      if (socket !== current) return;
      socket = null;
      const reason = event.reason || `closed with ${event.code}`;
      failWaiting(reason);
      if (FATAL.has(event.code)) {
        stopped = true;
        setState("failed", reason);
        return;
      }
      schedule(reason);
    });
  }

  void dial();

  return {
    get state() {
      return state;
    },
    call(method, params, { timeoutMs = callTimeoutMs } = {}) {
      if (state !== "open" || !socket) return Promise.reject(new HostCallError("peer-gone", "the plugin host is not connected"));
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new HostCallError("timeout", `${method} got no answer in ${timeoutMs} ms`));
        }, timeoutMs);
        waiting.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ type: "call", id, method, params }));
      });
    },
    close() {
      stopped = true;
      clearTimeout(retryTimer);
      failWaiting("closed by the window");
      socket?.close();
      socket = null;
      setState("closed");
    },
  };
}
