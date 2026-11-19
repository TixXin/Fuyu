import { takePendingPluginPackage } from "../../features/plugin-kernel/api";

export interface OpenedPluginPackage {
  seq: number;
  fileName: string;
  base64: string;
}

export type PluginDetailTab = "overview" | "settings" | "commands" | "activity";

export interface PluginDetailRequest {
  id: string;
  tab: PluginDetailTab;
}

export interface MarketViewRequest {
  detail?: string;
  query?: string;
}

type PendingResult = { pkg: OpenedPluginPackage | null; error: string | null };

let bufferedPackage: OpenedPluginPackage | null = null;
let inFlightPackage: Promise<PendingResult> | null = null;
let nextPackageSeq = 0;
let detailRequest: PluginDetailRequest | null = null;
let marketRequest: MarketViewRequest | null = null;

export function offerPluginPackage(fileName: string, base64: string): OpenedPluginPackage {
  nextPackageSeq += 1;
  bufferedPackage = { seq: nextPackageSeq, fileName, base64 };
  return bufferedPackage;
}

export function consumeBufferedPackage(seq: number) {
  if (bufferedPackage?.seq === seq) bufferedPackage = null;
}

export function pullPendingPackage(formatError: (error: unknown) => string): Promise<PendingResult> {
  if (inFlightPackage) return inFlightPackage;
  inFlightPackage = takePendingPluginPackage()
    .then((taken) => {
      if (taken) offerPluginPackage(taken.fileName, taken.base64);
      return { pkg: bufferedPackage, error: null };
    })
    .catch((failure: unknown) => ({ pkg: null, error: formatError(failure) }))
    .finally(() => {
      inFlightPackage = null;
    });
  return inFlightPackage;
}

export function requestPluginDetail(id: string, tab: PluginDetailTab = "overview") {
  detailRequest = { id, tab };
}

export function takePluginDetailRequest(): PluginDetailRequest | null {
  const request = detailRequest;
  detailRequest = null;
  return request;
}

export function requestMarketView(request: MarketViewRequest) {
  marketRequest = request;
}

export function takeMarketViewRequest(): MarketViewRequest | null {
  const request = marketRequest;
  marketRequest = null;
  return request;
}
