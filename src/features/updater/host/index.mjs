import { provideMarketService } from "./market.mjs";

export const name = "updater";

export function apply(ctx) {
  provideMarketService(ctx);
}
