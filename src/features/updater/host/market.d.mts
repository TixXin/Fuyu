import type { MarketCatalogSnapshot, MarketMethods } from "../../../../packages/plugin-services/src/services/market.mjs";

export interface MarketTrustKey {
  keyId: string;
  publicKey: string;
}

export interface MarketTrustRoot {
  index: readonly MarketTrustKey[];
  revocation: readonly MarketTrustKey[];
}

export interface CreateMarketServiceOptions {
  dataDir: string;
  pluginsDir?: string;
  appVersion?: string;
  platform?: "windows" | "macos";
  trust?: MarketTrustRoot;
  fetchImpl?: typeof fetch;
  indexUrl?: string;
  revokedUrl?: string;
  now?: number | Date | (() => number | Date);
  onConfigChanged?: () => Promise<void> | void;
}

export type MarketServiceInstance = {
  [K in keyof MarketMethods]: (
    ...args: Parameters<MarketMethods[K]>
  ) => Promise<ReturnType<MarketMethods[K]>>;
} & {
  autoUpdate(): Promise<MarketCatalogSnapshot>;
  subscribe(listener: (payload: Record<string, never>) => void): () => boolean;
};

export declare const DEFAULT_TRUST: MarketTrustRoot;
export declare const DEFAULT_INDEX_URL: string;
export declare const DEFAULT_REVOKED_URL: string;
export declare function parseAppVersionFromArgv(argv?: readonly string[]): string;
export declare function createMarketService(options: CreateMarketServiceOptions): MarketServiceInstance;
export declare function provideMarketService(ctx: unknown, options?: Partial<CreateMarketServiceOptions>): MarketServiceInstance;
