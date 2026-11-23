import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isMacOS } from "../../lib/platform";
import type { QuickTarget } from "./launcherItems.ts";

export type { QuickTarget };

export type SystemStats = {
  cpu: number | null;
  memory: { used: number; total: number } | null;
  network: { down: number; up: number } | null;
  battery: { level: number | null; pluggedIn: boolean } | null;
};

export type QuickAppInfo = { path: string; name: string; icon: string | null };

export function getSystemStats() {
  return invoke<SystemStats>("get_system_stats");
}

export function launchQuickApp(target: QuickTarget) {
  return invoke<void>("launch_quick_app", { target });
}

export function launchQuickAppPath(path: string) {
  return invoke<void>("launch_quick_app_path", { path });
}

export function quickAppInfo(path: string) {
  return invoke<QuickAppInfo>("quick_app_info", { path });
}

export async function pickQuickApp(title: string, filterName: string) {
  const picked = await open({
    title,
    multiple: false,
    directory: false,
    defaultPath: isMacOS ? "/Applications" : "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    filters: [{ name: filterName, extensions: isMacOS ? ["app"] : ["exe", "lnk"] }],
  });
  return typeof picked === "string" ? picked : null;
}
