import type { SlotName } from "./protocol.mjs";

export { Context, Service } from "cordis";

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
