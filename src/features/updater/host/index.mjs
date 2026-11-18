import { dirname } from "node:path";
import { provideMarketService } from "./market.mjs";
import { readInstalledPackages } from "./marketStore.mjs";

export const STARTUP_REFRESH_DELAY_MS = 30 * 1000;
export const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const name = "updater";

export function apply(ctx, options = {}) {
  const safeOptions = typeof options === "object" && options !== null ? options : {};
  const pluginsDir = safeOptions.pluginsDir ?? dirname(dirname(ctx.dataDir));
  const market = provideMarketService(ctx, safeOptions);
  const silentRefresh = () => {
    void market.refresh().catch(() => undefined);
  };

  let stopStartup = null;
  let stopInterval = null;

  const clearPolling = () => {
    if (stopStartup) {
      const fn = stopStartup;
      stopStartup = null;
      void fn();
    }
    if (stopInterval) {
      const fn = stopInterval;
      stopInterval = null;
      void fn();
    }
  };

  const syncPolling = (armStartup) => {
    if (readInstalledPackages(pluginsDir).length === 0) {
      clearPolling();
      return;
    }
    if (armStartup && !stopStartup && typeof ctx?.setTimeout === "function") {
      const delayMs = typeof safeOptions.startupDelayMs === "number" ? safeOptions.startupDelayMs : STARTUP_REFRESH_DELAY_MS;
      stopStartup = ctx.setTimeout(() => {
        stopStartup = null;
        silentRefresh();
      }, delayMs);
    }
    if (!stopInterval && typeof ctx?.setInterval === "function") {
      const intervalMs = typeof safeOptions.refreshIntervalMs === "number" ? safeOptions.refreshIntervalMs : REFRESH_INTERVAL_MS;
      stopInterval = ctx.setInterval(silentRefresh, intervalMs);
    }
  };

  syncPolling(true);
  const off = market.subscribe(() => syncPolling(false));
  if (typeof ctx?.effect === "function") ctx.effect(() => off, "updater.market.polling");
}
