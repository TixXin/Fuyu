import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const MARKET_INSTALL_EVENT = "plugin-market-install-requested";

export function takeMarketInstallRequest() {
  return invoke<string | null>("take_market_install_request");
}

export function listenMarketInstallRequests(onRequest: () => void) {
  return listen(MARKET_INSTALL_EVENT, () => onRequest());
}
