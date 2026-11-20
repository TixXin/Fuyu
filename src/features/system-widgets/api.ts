import { invoke } from "@tauri-apps/api/core";

export type SystemStats = {
  cpu: number | null;
  memory: { used: number; total: number } | null;
  network: { down: number; up: number } | null;
  battery: { level: number | null; pluggedIn: boolean } | null;
};

export type QuickTarget = "files" | "terminal" | "calculator" | "settings";

export function getSystemStats() {
  return invoke<SystemStats>("get_system_stats");
}

export function launchQuickApp(target: QuickTarget) {
  return invoke<void>("launch_quick_app", { target });
}
