import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export type FrontendErrorKind = "render" | "uncaught" | "startup" | "error" | "rejection" | "slot";

type DataHome = { home: string; crashLog?: string | null };

export function reportFrontendError(kind: FrontendErrorKind, message: string, stack: string | null) {
  return invoke<void>("report_frontend_error", { kind, message, stack });
}

export function closeCurrentWindow() {
  return getCurrentWindow().close();
}

export function restartApp() {
  return invoke<void>("tray_menu_action", { action: "restart", arg: null });
}

export async function revealCrashLog() {
  const info = await invoke<DataHome>("get_data_home");
  return revealItemInDir(info.crashLog?.trim() || info.home);
}
