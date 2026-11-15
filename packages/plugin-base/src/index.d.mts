import type { RustApi } from "./host/index.mjs";
import type { SlotName } from "./protocol.mjs";
import type { ServicesApi } from "./services.mjs";

export { Context, Service } from "cordis";
export type * from "./services.mjs";
export type { RustApi, RustCallOptions } from "./host/index.mjs";

declare module "cordis" {
  interface Context {
    setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): () => Promise<void>;
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => Promise<void>;
    sleep(ms: number): Promise<void>;
    clients: {
      add(window: string, url: string): () => Promise<void>;
      handle(method: string, handler: (params: any, caller: { window: string }) => unknown): () => Promise<void>;
      publish(topic: string, data?: unknown): void;
    };
    /**
     * Versioned services between plugins in the host (`timers/v1`). `provide` registers one until this plugin
     * stops; `get` returns a client whose methods find the current provider on every call. Users that need a
     * service list its name in `inject`, so they start only once it is there. See docs/architecture/plugins/v3-services.md.
     */
    services: ServicesApi;
    /**
     * Calls into Fuyu's Rust side and hears its events (host only). Calls fail with `peer-gone` when Rust is not
     * there and with `inactive` when this plugin stops; listeners go away with the plugin.
     */
    rust: RustApi;
    host: {
      call<T = unknown>(method: string, params?: unknown): Promise<T>;
      on(topic: string, listener: (data: any) => void): () => Promise<void>;
    };
    slots: {
      /**
       * Puts a component into a slot of the window this code runs in. The slot must be one of that window's
       * (`island.*` in the island), or the plugin fails with `no-slot`. An item with the id of an existing one
       * replaces it until this plugin stops. Extra fields are the slot's metadata (see `SLOTS` in
       * `@fuyu/plugin-base/protocol`). Experimental until phase 5: the props a slot passes to the component.
       */
      add(name: SlotName, item: { id: string; order?: number; component: unknown; [meta: string]: unknown }): () => Promise<void>;
    };
  }
}
