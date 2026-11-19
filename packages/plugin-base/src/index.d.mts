import type { RustApi } from "./host/index.mjs";
import type { SlotName } from "./protocol.mjs";
import type { Json, PluginWindowState, ServicesApi } from "./services.mjs";

export { Context, Service } from "cordis";
export type * from "./services.mjs";
export type { RustApi, RustCallOptions } from "./host/index.mjs";

export interface PluginWindowSpec {
  id: string;
  title?: string;
  kind?: string;
  width?: number;
  height?: number;
  x?: number | null;
  y?: number | null;
  alwaysOnTop?: boolean;
  clickThrough?: boolean;
  resizable?: boolean;
  visible?: boolean;
}

export interface PluginWindowPatch {
  title?: string;
  width?: number;
  height?: number;
  x?: number | null;
  y?: number | null;
  alwaysOnTop?: boolean;
  clickThrough?: boolean;
  resizable?: boolean;
  visible?: boolean;
}

export interface PluginWindowEvent {
  windowId: string;
  type: string;
  [key: string]: unknown;
}

export type HttpInput = string | { readonly href: string } | { readonly url: string };

export interface HttpResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly headers: unknown;
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
  [key: string]: any;
}

export type HttpFetch = (input: any, init?: Record<string, any>) => Promise<HttpResponseLike>;

declare module "cordis" {
  interface Context {
    dataDir: string;
    setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): () => Promise<void>;
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => Promise<void>;
    sleep(ms: number): Promise<void>;
    clients: {
      add(window: string, url: string): () => Promise<void>;
      handle(method: string, handler: (params: any, caller: { window: string }) => unknown): () => Promise<void>;
      publish(topic: string, data?: unknown): void;
    };
    commands: {
      register(
        commandId: string,
        handler: (args?: any) => unknown,
        meta?: { title?: Record<string, string>; keybinding?: string },
      ): () => Promise<void>;
    };
    config: {
      get<T extends Record<string, any> = Record<string, Json>>(): T;
      set<T extends Record<string, any> = Record<string, Json>>(patch: Partial<T>): Promise<T>;
      reset<T extends Record<string, any> = Record<string, Json>>(): Promise<T>;
      onChange<T extends Record<string, any> = Record<string, Json>>(listener: (values: T) => void): () => Promise<void>;
    };
    /**
     * The plugin's own page in Fuyu's settings. `open()` opens the settings window (or brings it to the front) on
     * this plugin's detail dialog, on its settings tab: the same place the gear on the plugin's row goes to. It
     * takes no arguments, because a plugin opens only its own settings; Fuyu fills in the plugin id. Window code
     * can call it in any window. Host code lists `settings` in `inject` and fails with `not-ready` while the island
     * window is not connected. Use it for a "Go to settings" button in an empty state, or when a notification
     * about a missing setting is clicked.
     */
    settings: {
      open(): Promise<void>;
    };
    /**
     * Fuyu's island, as far as this plugin's own `island.page/v1` pages go. Fuyu fills in the plugin id, so a plugin
     * can only open and close its own pages.
     *
     * `open(page?)` shows the island if it is hidden in the tray or tucked at the screen edge, expands it and switches
     * to one of this plugin's island pages: `page` is the id the plugin registered the page under, and without it the
     * plugin's first island page opens. It fails with `not-owner` when `page` belongs to another plugin or to Fuyu,
     * with `not-found` when no island page has that id, and with `no-page` when this plugin has no island page right
     * now. Window code can call it in any window. Host code lists `island` in `inject`; there `ctx.island` has only
     * `open`, and it fails with `not-ready` while the island window is not connected.
     *
     * `collapse()` collapses the island only when it is expanded on one of this plugin's pages, and resolves `true`.
     * Otherwise it leaves the island alone and resolves `false`, so a plugin never closes a page the user is reading.
     * Window code only. Use it after the user picks something on your page, like an app launcher that closes once the
     * app starts.
     */
    island: {
      open(page?: string): Promise<void>;
      collapse(): Promise<boolean>;
    };
    http: {
      fetch: HttpFetch;
    };
    windows: {
      create(spec: PluginWindowSpec): Promise<PluginWindowState>;
      update(id: string, patch: PluginWindowPatch): Promise<PluginWindowState>;
      show(id: string): Promise<PluginWindowState>;
      hide(id: string): Promise<PluginWindowState>;
      focus(id: string): Promise<PluginWindowState>;
      close(id: string): Promise<{ closed: boolean }>;
      list(): PluginWindowState[];
      onEvent(listener: (event: PluginWindowEvent) => void): () => Promise<void>;
    };
    /**
     * Versioned services between plugins in the host (`timers/v1`). `provide` registers one until this plugin
     * stops; `get` returns a client whose methods find the current provider on every call. Users that need a
     * service list its name in `inject`, so they start only once it is there. See docs/architecture/plugins/v3-services.md.
     */
    services: ServicesApi;
    /**
     * Calls into Fuyu's Rust side and hears its events (host only, built-in plugins only: for any other plugin
     * `call` and `on` fail with `forbidden`, and it uses services instead). Calls fail with `peer-gone` when Rust is
     * not there and with `inactive` when this plugin stops; listeners go away with the plugin.
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
       *
       * An `island.page/v1` page gets a button in the island's header, after the built-in pages: give it
       * `title` (a string, or `{ "zh-CN": "…", en: "…" }` picked by the interface language) and `icon` (a
       * component that takes `size` and `strokeWidth`). Without `title` the button uses the plugin's
       * `displayName`; without `icon`, the first letter of the title. `headerDot: false` keeps the page out of
       * the header, so only `Alt+number` and the page cycle reach it. `shortcutOrder` orders a plugin's pages
       * among plugin pages only; they always come after the built-in ones.
       *
       * An `island.collapsed/v1` item with `opens: "<page id>"` opens that page when it is clicked, or when it
       * has focus and Enter or Space is pressed; the host makes the whole item one focusable button. The id must
       * be one of this plugin's own `island.page/v1` pages: an id of another plugin's page or a built-in page is
       * ignored with a warning in the console. Clicks on the item's own buttons and links still go to them.
       *
       * An `island.collapsed/v1` item widens the collapsed island by the width it actually renders at, so
       * readings that change need no `width`. `width` (pixels, or a function of the bar's context) is a floor,
       * used until the item is measured. The island grows at once and shrinks only when the item is 32px
       * narrower, so a reading that changes every second does not resize the window back and forth. The bar is
       * at most 520px wide; past that the island's own text gives way first, then the item is faded out at its
       * right edge. Do not stretch the item with `width: 100%` or `flex: 1`: it is measured at its max-content
       * width.
       */
      add(name: SlotName, item: { id: string; order?: number; component: unknown; [meta: string]: unknown }): () => Promise<void>;
    };
  }
}
