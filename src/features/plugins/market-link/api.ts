import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Sent to the settings window when a `fuyu://market/install/<id>` link (the website's
 * Install button) is waiting. Same as MARKET_INSTALL_EVENT in
 * src-tauri/src/plugin_host/market_link.rs.
 */
export const MARKET_INSTALL_EVENT = "plugin-market-install-requested";

/** The plugin id a market link asked for, once; null when none is waiting. */
export function takeMarketInstallRequest() {
  return invoke<string | null>("take_market_install_request");
}

/** Calls `onRequest` when a market link is waiting; resolves to the unlisten function. */
export function listenMarketInstallRequests(onRequest: () => void) {
  return listen(MARKET_INSTALL_EVENT, () => onRequest());
}
