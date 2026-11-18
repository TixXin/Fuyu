import type { ServiceDefinition } from "../define.mjs";

export type MarketLocalizedText = {
  "zh-CN": string;
  en: string;
};

export type MarketTrustChange = "unendorsed-key" | "endorsed-key" | "repo-changed";

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
  trustChange?: MarketTrustChange;
  requiredPlugins?: string[];
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
  trustChange?: MarketTrustChange;
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

export type MarketPluginScreenshot = {
  url: string;
  caption?: Record<string, string>;
};

export type MarketPluginCommand = {
  id: string;
  title: Record<string, string>;
  keybinding?: string;
};

export type MarketPluginVersionSummary = {
  version: string;
  publishedAt?: string | null;
  size?: number | null;
  reviewed?: boolean;
  urgent?: boolean;
  enginesFuyu?: string | null;
};

export type MarketPluginDetails = {
  name: string;
  displayName?: Record<string, string>;
  description?: Record<string, string>;
  official: boolean;
  publisherName?: string;
  author?: string | null;
  license?: string | null;
  homepage?: string | null;
  repository?: string | null;
  bugs?: string | null;
  funding?: string | null;
  keywords: string[];
  categories: string[];
  platforms: string[];
  preview: boolean;
  likes: number | null;
  installedVersion: string | null;
  latestVersion: string | null;
  readme: string | null;
  changelog: string | null;
  screenshots: MarketPluginScreenshot[];
  commands: MarketPluginCommand[];
  slots: string[];
  provides: string[];
  replaces: string[];
  network: string[];
  nodeApis: string[];
  requires: Record<string, string>;
  versions: MarketPluginVersionSummary[];
};

export type MarketMethods = {
  catalog(): MarketCatalogSnapshot;
  refresh(): MarketCatalogSnapshot;
  details(params: { name: string; locale?: string }): MarketPluginDetails;
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
