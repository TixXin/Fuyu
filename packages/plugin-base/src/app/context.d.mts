export type PluginSetupHint = string | { "zh-CN"?: string; en?: string };

export interface PluginSetupState {
  needed: boolean;
  hint?: PluginSetupHint | null;
}

export interface AppContext {
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
    /**
     * Tells Fuyu whether this plugin still needs a setting before it is of any use (weather without a city, an
     * issue list without a repository). While `needed` is `true` and the plugin runs, its row on the plugin page
     * carries a "Needs setup" mark with a button that opens its settings, and the notice shown right after
     * installing it offers the same button. `hint` is one short line saying what is missing, as a string or per
     * language (`{ "zh-CN": "选一个城市", en: "Pick a city" }`); it is cut at 80 characters. Call it again with
     * `needed: false` once the setting is filled in, and the mark goes away. Call it on start and whenever the
     * setting changes: the last call wins, from host code or from any window, and the state is dropped when the
     * plugin stops. Host code lists `settings` in `inject`. Older versions of Fuyu have no `setup`, so call it
     * as `ctx.settings.setup?.(...)`.
     */
    setup(state: PluginSetupState): Promise<void>;
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
}
