export const LOCAL_PROXIES = ["auto", "clash-verge", "v2rayn", "custom"] as const;
export type LocalProxyChoice = (typeof LOCAL_PROXIES)[number];

export const DEFAULT_CUSTOM_PORT = 7897;

export function localProxySetting(config: Readonly<Record<string, unknown>>): LocalProxyChoice {
  const value = config.localProxy;
  return typeof value === "string" && (LOCAL_PROXIES as readonly string[]).includes(value) ? (value as LocalProxyChoice) : "auto";
}

export function customPortSetting(config: Readonly<Record<string, unknown>>): number {
  const value = config.customPort;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535 ? value : DEFAULT_CUSTOM_PORT;
}
