import { PEER_GONE, RpcError } from "./rpc.mjs";

export const RUST_TIMEOUT_MS = 120_000;
const NAME = /^[a-z][A-Za-z0-9-]*(\.[a-z][A-Za-z0-9-]*)*$/;
const eventKey = (name) => `rust:${name}`;

export function rustError(code, message, data) {
  return new RpcError(code, message, data);
}

function checkName(kind, name) {
  if (typeof name !== "string" || !NAME.test(name)) throw rustError("bad-params", `${String(name)} is not the name of a Rust ${kind}`);
}

export class RustBridge {
  constructor() {
    this.rpc = null;
    this.root = null;
  }

  install(ctx) {
    const bridge = this;
    this.root = ctx;
    return ctx.reflect.accessor("rust", {
      get() {
        const caller = this;
        return Object.freeze({
          call: (method, params, options) => bridge.call(caller, method, params, options),
          on: (event, listener) => bridge.on(caller, event, listener),
        });
      },
    });
  }

  attach(rpc) {
    this.rpc = rpc;
    rpc.handle("event", (params) => this.deliver(params));
  }

  deliver(params) {
    if (!this.root || typeof params?.name !== "string" || !NAME.test(params.name)) return;
    this.root.emit(eventKey(params.name), params.data ?? null);
  }

  call(ctx, method, params, options = {}) {
    try {
      checkName("method", method);
    } catch (error) {
      return Promise.reject(error);
    }
    if (!this.rpc) return Promise.reject(rustError(PEER_GONE, `Rust is not connected, so ${method} cannot be called`, { method }));
    const timeoutMs = Number.isInteger(options?.timeoutMs) && options.timeoutMs > 0 ? Math.min(options.timeoutMs, RUST_TIMEOUT_MS) : RUST_TIMEOUT_MS;
    const controller = new AbortController();
    const stop = ctx.effect(() => () => controller.abort(rustError("inactive", `the plugin stopped while waiting for Rust's ${method}`, { method })), `ctx.rust.call(${method})`);
    return this.rpc.call(method, params ?? null, { timeoutMs, onProgress: options?.onProgress, signal: controller.signal }).finally(() => void stop());
  }

  on(ctx, event, listener) {
    checkName("event", event);
    if (typeof listener !== "function") throw rustError("bad-params", `ctx.rust.on(${event}) needs a listener`);
    return ctx.on(eventKey(event), listener);
  }
}
