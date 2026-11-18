import type { ServiceDefinition } from "../define.mjs";

export type MarketLocalizedText = {
  "zh-CN": string;
  en: string;
};

export type PluginInstallConfirmation = {
  unreviewed: boolean;
  official?: boolean;
  displayName?: MarketLocalizedText | string;
  description?: MarketLocalizedText | string;
  network: string[];
  nodeApis: string[];
  provides: string[];
  replaces: string[];
  slots: string[];
};

export type MarketVersionCandidate = {
  version: string;
  sha256: string;
  size: number;
  publishedAt: string;
  fresh?: boolean;
  cooled?: boolean;
  warned?: boolean;
  urgent?: boolean;
  confirmation: PluginInstallConfirmation;
};

export type MarketCatalogPlugin = {
  name: string;
  official: boolean;
  publisher: { github: string; official: boolean };
  displayName: MarketLocalizedText;
  description: MarketLocalizedText;
  categories: string[];
  installedVersion: string | null;
  enabled: boolean;
  source: "market" | "manual" | null;
  revoked: boolean;
  install: MarketVersionCandidate | null;
  manual: MarketVersionCandidate | null;
  autoUpdate: MarketVersionCandidate | null;
};

export type InstalledMarketPlugin = {
  id: string;
  version: string;
  source: "market" | "manual";
  enabled: boolean;
  displayName?: MarketLocalizedText | string;
  description?: MarketLocalizedText | string;
};

export type MarketCatalogSnapshot = {
  plugins: MarketCatalogPlugin[];
  installed: InstalledMarketPlugin[];
  updatedAt: number | null;
  manualAllowed: boolean;
  error: string | null;
};

export type MarketInspectedPackage = {
  id: string;
  version: string;
  sha256: string;
  confirmation: PluginInstallConfirmation;
};

export type MarketInstallResult = {
  id: string;
  version: string;
  source: "market" | "manual";
  sha256: string;
  confirmation: PluginInstallConfirmation;
};

export type MarketMethods = {
  catalog(): MarketCatalogSnapshot;
  refresh(): MarketCatalogSnapshot;
  inspectPackage(params: { base64: string }): MarketInspectedPackage;
  installMarket(params: { name: string; version?: string }): MarketInstallResult;
  installFile(params: { base64: string; expectedSha256?: string }): MarketInstallResult;
  setManualAllowed(params: { allowed: boolean }): { manualAllowed: boolean };
  setEnabled(params: { id: string; enabled: boolean }): { id: string; enabled: boolean };
  uninstall(params: { id: string; removeData?: boolean }): { id: string; removed: true };
};

export type MarketEvents = {
  changed: {};
};

export const marketV1: ServiceDefinition<MarketMethods, MarketEvents, {}>;
