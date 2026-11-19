import { openUrl } from "@tauri-apps/plugin-opener";
import { marketV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../features/plugin-kernel/services";

export const marketClient = windowServices.get(marketV1);

export async function restartPlugin(id: string): Promise<void> {
  await marketClient.setEnabled({ id, enabled: false });
  await marketClient.setEnabled({ id, enabled: true });
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readPackageFile(file: File): Promise<string> {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

export const PLUGIN_DOCS_URL = "https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md";

export function openPluginDocs() {
  void openUrl(PLUGIN_DOCS_URL).catch(() => undefined);
}

export function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

export function openHttpUrl(url: string) {
  if (isHttpUrl(url)) void openUrl(url.trim()).catch(() => undefined);
}
